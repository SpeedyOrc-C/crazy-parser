import {alt, str, map, opt, TParser, pred, some, span, alts, many} from "./Parser";

const entityMapping = new Map<string, string>([
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", "\""],
    ["&apos;", "'"],
]);

export const tagNameP: TParser<string> = async (s: string) =>
{
    const [name, tail] =
        await pred(c => c.match(/[a-zA-Z_]/) !== null)(s);

    const [restName, tail2] =
        await opt(span(c => c.match(/[a-zA-Z0-9_.\-]/) !== null))(tail);

    return [name + (restName ?? ""), tail2];
};

export const someWhitespaceP: TParser<string | null> =
    opt(span(c => c.match(/\s/) !== null));

export class Attribute
{
    constructor(public key: string, public value: string)
    {
    }

    static attributeValueEscapeMapping =
        new Map<string, string>([
            ["\"", "&quot;"],
            ["'", "&apos;"],
        ]);

    static async attributeValueInnerP(input: string): Promise<[string, string]>
    {
        let end = input.length;
        for (let i = 0; i < input.length; i += 1) {
            if (input[i] == '"' || input[i] == "'") {
                end = i;
                break;
            }
        }

        let textNodeRaw = input.slice(0, end);
        const tail = input.slice(end);

        for (const [entity, char] of entityMapping) {
            textNodeRaw = textNodeRaw.replaceAll(entity, char);
        }

        return [textNodeRaw, tail];
    }

    static attributeValueP: TParser<string> = async (s: string) =>
    {
        const [delimiter, tail] = await alt(str("\""), str("'"))(s);
        const [value, tail2] = await Attribute.attributeValueInnerP(tail);
        const [, tail3] = await pred(c => c == delimiter)(tail2);
        return [value, tail3];
    }

    static async parse(s: string): Promise<[Attribute, string]>
    {
        const [key, tail] = await tagNameP(s);
        const [, tail2] = await someWhitespaceP(tail);
        const [, tail3] = await str("=")(tail2);
        const [, tail4] = await someWhitespaceP(tail3);
        const [value, tail5] = await Attribute.attributeValueP(tail4);
        return [new Attribute(key, value), tail5];
    }

    dump(): string
    {
        return `${this.key}="${this.value.split("").map(c => Attribute.attributeValueEscapeMapping.get(c) ?? c).join("")}"`;
    }
}

export abstract class BaseNode implements IBaseNode
{
    abstract dump(): string;

    parent: Tag | null = null;

    replaceWith(node: IBaseNode): void
    {
        if (this.parent == null)
            throw new Error("Cannot replace a node without a parent");

        const index = this.parent.children.indexOf(this);
        this.parent.children.splice(index, 1, node);
        node.parent = this.parent;
    }

    static inlineLevelTags = new Set([
        "span", "em", "b", "i", "q", "mark"
    ]);

    mergeContinuousTexts(recursive=true): void
    {
        if (!(this instanceof Tag)) return;

        if (this.children.length <= 1) return;

        const length = this.children.length;
        const children: IBaseNode[] = [];

        for (let left = 0; left < length;) {

            if (!(this.children[left] instanceof TextNode)) {
                if (recursive) {
                    this.children[left].mergeContinuousTexts(recursive)
                }

                children.push(this.children[left]);
                left += 1;
                continue;
            }

            let right = left;
            while (right <= length && this.children[right] instanceof TextNode)
                right += 1;

            const texts: string[] = []

            for (let i = left; i < right; i += 1)
                texts.push((this.children[i] as TextNode).text)

            const node = new TextNode(texts.join(""));
            node.parent = this;
            children.push(node)

            left = right;
        }

        this.children = children;
    }

    flattenInline(recursive=true): void
    {
        if (!(this instanceof Tag)) return;

        const children: IBaseNode[] = [];

        for (const c of this.children) {
            if (!(c instanceof Tag)) {
                children.push(c);
                continue;
            }

            if (recursive) {
                c.flattenInline();
            }

            if (BaseTag.inlineLevelTags.has(c.tagName)) {
                for (const cc of c.children) {
                    cc.parent = this;
                    children.push(cc);
                }
            } else {
                children.push(c);
            }
        }

        this.children = children;

        this.mergeContinuousTexts(recursive);
    }
}

export interface IBaseNode
{
    parent: Tag | null;

    dump(): string;

    replaceWith(node: IBaseNode): void;

    mergeContinuousTexts(recursive: boolean): void

    flattenInline(): void
}

export class BaseTag extends BaseNode implements IBaseNode
{
    constructor(public tagName: string, public attributes: Attribute[])
    {
        super();
    }

    static attributeWithPrecedingWhitespaceP: TParser<Attribute> = async (s: string) =>
    {
        const [, tail] = await someWhitespaceP(s);
        const [attr, tail2] = await Attribute.parse(tail);
        return [attr, tail2];
    };

    static async parse(s: string): Promise<[BaseTag, string]>
    {
        const [tagName, tail] = await tagNameP(s);
        const [attributes, tail2] = await some(BaseTag.attributeWithPrecedingWhitespaceP)(tail);
        return [new BaseTag(tagName, attributes), tail2];
    }

    dump(): string
    {
        return `${this.tagName}${this.attributes.map(a => " " + a.dump()).join("")}`;
    }
}

export class Tag extends BaseTag
{
    constructor(tagName: string, attributes: Attribute[], public children: IBaseNode[])
    {
        super(tagName, attributes);
        this.children.forEach(c => c.parent = this);
    }

    static async parse(s: string): Promise<[Tag, string]>
    {
        const [, tail] = await str("<")(s);
        const [, tail2] = await someWhitespaceP(tail);
        const [tag, tail3] = await BaseTag.parse(tail2);
        const [, tail4] = await someWhitespaceP(tail3);
        const [, tail5] = await str(">")(tail4);
        const [children, tail6] = await some(nodeP)(tail5);
        const [, tail7] = await str("</")(tail6);
        const [, tail8] = await someWhitespaceP(tail7);
        const [, tail9] = await str(tag.tagName)(tail8);
        const [, tail10] = await someWhitespaceP(tail9);
        const [, tail11] = await str(">")(tail10);
        return [new Tag(tag.tagName, tag.attributes, children), tail11];
    }

    dump(): string
    {
        return `<${super.dump()}>${this.children.map(c => c.dump()).join("")}</${this.tagName}>`;
    }

    leaves(): (TagVoid | TextNode)[]
    {
        const result: (TagVoid | TextNode)[] = [];

        for (const c of this.children)
            if (c instanceof Tag)
                result.push(...c.leaves())
            else if (c instanceof TagVoid || c instanceof TextNode)
                result.push(c)

        return result;
    }

    texts(): TextNode[]
    {
        const result: TextNode[] = [];

        for (const c of this.children)
            if (c instanceof Tag)
                if (c.tagName != "span")
                    result.push(...c.texts())
                else
                    result.push(...c.texts())
            else if (c instanceof TextNode)
                result.push(c)

        return result;
    }
}

export class TagVoid extends BaseTag
{
    constructor(tagName: string, attributes: Attribute[])
    {
        super(tagName, attributes);
    }

    static allowedNames = [
        "br", "hr", "img", "input",
        "meta", "link", "base", "area", "col",
        "embed", "param", "source", "track", "wbr"
    ];

    static async parse(s: string): Promise<[TagVoid, string]>
    {
        const [, tail] = await str("<")(s);
        const [, tail2] = await someWhitespaceP(tail);
        const [tag, tail3] = await BaseTag.parse(tail2);
        if (!TagVoid.allowedNames.includes(tag.tagName)) throw new Error();
        const [, tail4] = await someWhitespaceP(tail3);
        const [, tail5] = await opt(str("/"))(tail4); // TODO: only XHTML allows this
        const [, tail6] = await someWhitespaceP(tail5);
        const [, tail7] = await str(">")(tail6);
        return [new TagVoid(tag.tagName, tag.attributes), tail7];
    }

    dump(): string
    {
        return `<${super.dump()}>`;
    }
}

export class TextNode extends BaseNode implements IBaseNode
{
    constructor(public text: string)
    {
        super();
    }

    static characterEscapeMapping = new Map<string, string>([
        ["&", "&amp;"],
        ["<", "&lt;"],
        [">", "&gt;"],
        [" ", "&nbsp;"],
    ]);

    static async parse(input: string): Promise<[TextNode, string]>
    {
        let end = input.length;
        for (let i = 0; i < input.length; i += 1) {
            if (input[i] == "<" || input[i] == ">") {
                end = i;
                break;
            }
        }

        if (end == 0) throw new Error();

        let textNodeRaw = input.slice(0, end);
        const tail = input.slice(end);

        for (const [entity, char] of entityMapping) {
            textNodeRaw = textNodeRaw.replaceAll(entity, char);
        }

        return [new TextNode(textNodeRaw), tail];
    }

    dump(): string
    {
        return this.text.split("").map(c => TextNode.characterEscapeMapping.get(c) ?? c).join("");
    }
}

export const nodeP: TParser<IBaseNode> = alts<IBaseNode>(Tag.parse, TagVoid.parse, TextNode.parse);

export const documentP: TParser<IBaseNode[]> = some(nodeP);
