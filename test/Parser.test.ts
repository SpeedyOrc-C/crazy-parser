import {str, strict} from "../src/Parser";

test("str / strict", async () =>
{
    const [a, b] = await str("123")("12345");
    expect(a).toBe("123");
    expect(b).toBe("45");

    try {
        await strict(str("123"))("12345");
        fail();
    } catch (e) {
    }

    const [c, _] = await strict(str("12345"))("12345");
    expect(c).toBe("12345");
});
