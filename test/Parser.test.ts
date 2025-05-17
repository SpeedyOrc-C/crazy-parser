import {alpha, asum, char, digit, eof, Fail, lazy, many, Parser, some, template} from "../src/Parser";


test("Time", () =>
{
    const d24 = digit.x(2)
        .map(cs => parseInt(cs.join("")))
        .where(x => 0 <= x && x <= 23)

    const d60 = digit.x(2)
        .map(cs => parseInt(cs.join("")))
        .where(h => 0 <= h && h <= 59)

    const time = template`${d24}:${d60}:${d60}`

    const result = time.parse("12:34:56")

    if (result == Fail)
        fail()

    expect(result[0]).toStrictEqual([12, 34, 56])
})


test("Recursive in a Pair", () =>
{
    const a: () => Parser<string> = () => lazy(() =>
        char("A").and(b().or(char("!"))).map(xs => xs.join("")))

    const b: () => Parser<string> = () => lazy(() =>
        char("B").and(a().or(char("!"))).map(xs => xs.join("")))

    const result = a().parse("ABABABABABAB!")

    if (result == Fail)
        fail()

    expect(result[0]).toBe("ABABABABABAB!")
})


test("S Expression", () =>
{
    class Id
    {
        constructor(public name: string) {}

        show(): string { return this.name }
    }

    class Ap
    {
        constructor(public f: Expression, public x: Expression) {}

        show(): string { return `(${this.f.show()} ${this.x.show()})` }
    }

    type Expression = Id | Ap

    const id =
        some(digit.or(alpha)).map(id => new Id(id.join("")))

    const white =
        asum([" ", "\t", "\n", "\r"].map(char))

    const expr = (): Parser<Expression> => lazy(() =>
    {
        const applyInner =
            expr().and(many(some(white).$_(expr())))

        const apply =
            char("(").and(many(white))
                .$_(applyInner)
                .map(r => r[1]
                    .reduce((a, b) => new Ap(a, b), r[0]))
                ._$(many(white).and(char(")")))

        return id.or(apply)
    })

    const exprWithWhite = many(white).$_(expr())._$(many(white))._$(eof)

    const result = exprWithWhite.parse(`
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
        fail()

    expect(result[0]).toStrictEqual(
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
