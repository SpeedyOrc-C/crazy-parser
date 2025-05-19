import {test, expect, assert} from "vitest"
import Parser, {alpha, anyChar, char, digit, eof, Fail, lazy, Nothing, pure, space, str, tab, template} from "../src";
import {many, optional, some} from "../src/prefix";


test("Boolean", () =>
{
    const bool = str("true").cmap(true).or(str("false").cmap(false))

    const r1 = bool.eval("true")
    const r2 = bool.eval("false")
    const r3 = bool.eval("42")

    if (r1 == Fail) assert.fail()
    if (r2 == Fail) assert.fail()
    if (r3 != Fail) assert.fail()

    expect(r1).toBe(true)
    expect(r2).toBe(false)
})


test("Try", () =>
{
    const p1 = char("1").and(char("2")).or(str("13"))
    const p2 = char("1").and(char("2")).try().or(str("13"))

    const r1 = p1.eval("13")
    const r2 = p1.eval("113")
    const r3 = p2.eval("13")

    expect(r1).toBe(Fail)
    expect(r2).toBe("13")
    expect(r3).toBe("13")
})


test("List of Integers", () =>
{
    const _ints = (): Parser<number[]> => lazy(() =>
        some(digit).bind(cs1 =>
            optional(char(",").$_(optional(_ints()))).bind(css =>
                pure([
                    parseInt(cs1.join("")),
                    ...(css == Nothing ? [] : css)
                ])
            )
        )
    )

    const ints = _ints()

    const r1 = ints.eval("1")
    const r2 = ints.eval("1,")
    const r3 = ints.eval("123,4,5,6,7")
    const r4 = ints.eval("1,2,3,4,567,")

    if (r1 == Fail) assert.fail()
    if (r2 == Fail) assert.fail()
    if (r3 == Fail) assert.fail()
    if (r4 == Fail) assert.fail()

    expect(r1).toStrictEqual([1])
    expect(r2).toStrictEqual([1])
    expect(r3).toStrictEqual([123, 4, 5, 6, 7])
    expect(r4).toStrictEqual([1, 2, 3, 4, 567])
})

test("Time", () =>
{
    const d24 = digit.x(2)
        .map(cs => parseInt(cs.join("")))
        .where(x => 0 <= x && x <= 23)

    const d60 = digit.x(2)
        .map(cs => parseInt(cs.join("")))
        .where(h => 0 <= h && h <= 59)

    const time = template`${d24}:${d60}:${d60}`._$(eof)

    const result = time.eval("12:34:56")

    if (result == Fail)
        assert.fail()

    expect(result).toStrictEqual([12, 34, 56])
})


test("Recursion between 2", () =>
{
    const a: () => Parser<string> = () => lazy(() =>
        char("A").and(b().or(char("!"))).map(xs => xs.join("")))

    const b: () => Parser<string> = () => lazy(() =>
        char("B").and(a().or(char("!"))).map(xs => xs.join("")))

    const result = a()._$(eof).eval("ABABABABABAB!")

    if (result == Fail)
        assert.fail()

    expect(result).toBe("ABABABABABAB!")
})


test("Promise", async () =>
{
    await str("hello").evalPromise("hello")
    await str("hello").runPromise("hello")

    try
    {
        await str("world").evalPromise("World")
        await str("world").runPromise("World")
        assert.fail("Parser didn't fail.")
    }
    catch (e)
    {
    }
})


test("S Expression", () =>
{
    class Id
    {
        constructor(public name: string) {}
    }

    class Ap
    {
        constructor(public f: Expression, public x: Expression) {}
    }

    type Expression = Id | Ap

    const id =
        some(digit.or(alpha)).map(id => new Id(id.join("")))

    const white = space.or(tab).or(anyChar(["\n", "\r"]))

    const expr = (): Parser<Expression> => lazy(() =>
    {
        const begin = char("(").and(many(white))
        const applyInner = expr().and(many(some(white).$_(expr())))
        const end = many(white).and(char(")"))

        const apply = begin.$_(applyInner)._$(end)
            .map(r => r[1].reduce((a, b) => new Ap(a, b), r[0]))

        return id.or(apply)
    })

    const exprWithWhite = many(white).$_(expr())._$(many(white))._$(eof)

    const result = exprWithWhite.eval(`
        (if (equal (plus 1 1) 2)
        (
            (print (Be You Genius))
        ) (
            (for x 1 100 (
                (print (Oh No))
            ))
        ))
    `)

    if (result == Fail)
        assert.fail()

    expect(result).toStrictEqual(
        new Ap(
            new Ap(
                new Ap(
                    new Id("if"),
                    new Ap(
                        new Ap(
                            new Id("equal"),
                            new Ap(
                                new Ap(
                                    new Id("plus"),
                                    new Id("1")
                                ),
                                new Id("1")
                            )
                        ),
                        new Id("2")
                    )
                ),
                new Ap(
                    new Id("print"),
                    new Ap(
                        new Ap(
                            new Id("Be"),
                            new Id("You")
                        ),
                        new Id("Genius")
                    )
                )
            ),
            new Ap(
                new Ap(
                    new Ap(
                        new Ap(
                            new Id("for"),
                            new Id("x")
                        ),
                        new Id("1")
                    ),
                    new Id("100")
                ),
                new Ap(
                    new Id("print"),
                    new Ap(
                        new Id("Oh"),
                        new Id("No")
                    )
                )
            )
        )
    );
})
