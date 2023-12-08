import {documentP, Tag, TagVoid, TextNode} from "../src/HTML";

test("nodeP", async () => {
    const [[a, b, c]] =
        await documentP(`<div>Hello</div><img alt="description &amp; care"><p>Wo<b>r</b>ld</p>`);

    if (!(a instanceof Tag)) throw new Error();
    if (!(b instanceof TagVoid)) throw new Error();
    if (!(c instanceof Tag)) throw new Error();

    expect(a.tagName).toBe("div");
    expect(a.children).toHaveLength(1);
    expect(a.children[0]).toBeInstanceOf(TextNode);
    expect(a.children[0].dump()).toBe("Hello");

    expect(b.tagName).toBe("img");
    expect(b.attributes).toHaveLength(1);
    expect(b.attributes[0].key).toBe("alt");
    expect(b.attributes[0].value).toBe("description & care");

    expect(c.tagName).toBe("p");
    expect(c.children).toHaveLength(3);
    expect(c.children[0]).toBeInstanceOf(TextNode);
    expect((c.children[0] as TextNode).text).toBe("Wo");
    expect(c.children[1]).toBeInstanceOf(Tag);
    expect((c.children[1] as Tag).tagName).toBe("b");
    expect((c.children[1] as Tag).children).toHaveLength(1);
    expect((c.children[1] as Tag).children[0]).toBeInstanceOf(TextNode);
    expect(((c.children[1] as Tag).children[0] as TextNode).text).toBe("r");
    expect(c.children[2]).toBeInstanceOf(TextNode);
    expect((c.children[2] as TextNode).text).toBe("ld");
});
