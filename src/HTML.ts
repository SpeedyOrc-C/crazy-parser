import {alt, str, map, opt, TParser, pred, some, span, alts, many} from "./Parser";

class Entity
{
    static entityMapping = new Map<string, string>([
        ["amp", "&"],
        ["lt", "<"],
        ["gt", ">"],
        ["quot", "\""],
        ["apos", "'"],
    ]);

    static baseEntityP = (invalidChars: Set<string>): TParser<string> => (s: string) => new Promise((just, nothing) =>
    {
        if (s.length == 0) {
            nothing();
        } else if (s.startsWith("&")) {
            s = s.slice(1);
            for (const [entity, char] of Entity.entityMapping) {
                if (s.startsWith(entity + ";")) {
                    just([char, s.slice(entity.length + 1)]);
                }
            }
            nothing();
        } else {
            for (const char of invalidChars) {
                if (s.startsWith(char)) {
                    nothing();
                }
            }
            just([s[0], s.slice(1)]);
        }
    });

    static parse = Entity.baseEntityP(new Set(["<", ">"]));
    static parseStr = Entity.baseEntityP(new Set(["\"", "'"]));
}

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

    static attributeValueP: TParser<string> = async (s: string) =>
    {
        const [delimiter, tail] = await alt(str("\""), str("'"))(s);
        const [value, tail2] = await some(Entity.parseStr)(tail);
        const [, tail3] = await pred(c => c == delimiter)(tail2);
        return [value.join(""), tail3];
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

export abstract class BaseNode
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
}

export interface IBaseNode
{
    parent: Tag | null;

    dump(): string;

    replaceWith(node: IBaseNode): void;
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
    ]);

    static parse: TParser<TextNode> = map(many(Entity.parse), cs => new TextNode(cs.join("")));

    dump(): string
    {
        return this.text.split("").map(c => TextNode.characterEscapeMapping.get(c) ?? c).join("");
    }
}

export const nodeP: TParser<IBaseNode> = alts<IBaseNode>(Tag.parse, TagVoid.parse, TextNode.parse);

export const documentP: TParser<IBaseNode[]> = some(nodeP);
