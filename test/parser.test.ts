import {test, expect, assert} from "vitest"
import {
	Parser,
	alpha,
	anyChar,
	anyStr,
	asum,
	char,
	digit,
	empty,
	eof, index,
	lazy,
	Nothing,
	one,
	pure, sequence,
	space,
	span,
	str,
	tab,
	template
} from "../src"
import {many, optional, some, withRange} from "../src/prefix"

test("Boolean", () =>
{
	const bool = str("true").cmap(true).or(str("false").cmap(false))

	expect(bool.eval("true")).toBe(true)
	expect(bool.eval("false")).toBe(false)
	expect(bool.eval("42")).instanceof(Error)
})


test("If", () =>
{
	expect(pure(42).if(true).eval("")).toBe(42)
	expect(pure(42).if(false).eval("")).instanceOf(Error)
	expect(empty.if(true).eval("")).instanceOf(Error)
	expect(empty.if(false).eval("")).instanceOf(Error)
})


test("One & Many", () =>
{
	expect(one.x(3).eval("123")).toStrictEqual(["1", "2", "3"])
	expect(one.x(4).eval("123")).instanceOf(Error)

	try
	{
		// TS cannot check if a number is positive with its type system (easily).
		// So this line will always give an error. So we
		// @ts-ignore
		one.x(-1)
		assert.fail()
	}
	catch (e)
	{}
})


test("Any", () =>
{
	expect(anyChar(["1", "2", "3"]).eval("1")).toBe("1")
	expect(anyStr(["123", "456", "789"]).eval("456")).toBe("456")
})


test("Try", () =>
{
	const p1 = char("1").and(char("2")).or(str("13"))
	const p2 = char("1").and(char("2")).try().or(str("13"))

	const r1 = p1.eval("13")
	const r2 = p1.eval("113")
	const r3 = p2.eval("13")

	expect(r1).instanceOf(Error)
	expect(r2).toBe("13")
	expect(r3).toBe("13")
})


test("Span & Range", () =>
{
	const p =
		span(c => '1' <= c && c <= '3')
			.$_(span(c => '4' <= c && c <= '6')
				.withRange().map(r => r[1]))
			._$(span(c => '7' <= c && c <= '9'))

	expect(p.eval("321444455556666789")).toStrictEqual([3, 15])
	expect(one.withRange().eval("")).instanceOf(Error)
})


test("Alternative Sum", () =>
{
	expect(asum([str("114514"), str("42")]).eval("114514")).toBe("114514")
	expect(asum([]).eval("114514")).instanceOf(Error)
})


test("EOF", () =>
{
	expect(eof.eval("")).not.instanceOf(Error)
	expect(eof.eval("1")).instanceOf(Error)
	expect(eof.eval("123")).instanceOf(Error)
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

	expect(time.eval("12:34:56")).toStrictEqual([12, 34, 56])
	expect(time.eval("99:99:99")).instanceOf(Error)
	expect(time.eval("9:9:9")).instanceOf(Error)
})


test("Recursion between 2", () =>
{
	const a: () => Parser<string> = () => lazy(() =>
		char("A").and(b().or(char("!"))).map(xs => xs.join("")))

	const b: () => Parser<string> = () => lazy(() =>
		char("B").and(a().or(char("!"))).map(xs => xs.join("")))

	const result = a()._$(eof).eval("ABABABABABAB!")

	expect(result).toBe("ABABABABABAB!")
})


test("Promise", async () =>
{
	await str("hello").evalPromise("hello")
	await str("hello").runPromise("hello")

	try
	{
		await str("world").evalPromise("World")
		assert.fail("Parser didn't fail.")
	}
	catch (e)
	{}

	try
	{
		await str("world").runPromise("World")
		assert.fail("Parser didn't fail.")
	}
	catch (e)
	{}
})


test("Trace", () =>
{
	pure(42).trace("Tracing a successful parser").eval("")
	empty.trace("Tracing a failed parser").eval("")
})


test("Index", () =>
{
	expect(sequence(str("apple"), index, str("banana")).eval("applebanana")).toStrictEqual(["apple", 5, "banana"])
})


test("Other prefix functions", () =>
{
	expect(optional(one).eval("42")).toBe("4")
	expect(withRange(one).eval("42")).toStrictEqual(["4", [0, 1]])
})


test("Variable-length arguments", () =>
{
	expect(asum(char("1"), char("2")).eval("2")).toBe("2")
	expect(asum([char("1"), char("2")]).eval("2")).toBe("2")
	expect(sequence(char("1"), char("2")).eval("12")).toStrictEqual(["1", "2"])
	expect(sequence([char("1"), char("2")]).eval("12")).toStrictEqual(["1", "2"])
})


test("Custom errors", () =>
{
	class MissingA extends Error {}

	class MissingB extends Error {}

	class MissingC extends Error {}

	const p = sequence(
		char("A").error(new MissingA()),
		char("B").error(new MissingB()),
		char("C").error(new MissingC()),
	)

	expect(p.eval("")).instanceof(MissingA)
	expect(p.eval("A")).instanceof(MissingB)
	expect(p.eval("AB")).instanceof(MissingC)
	expect(p.eval("")).instanceof(Error)
	expect(p.eval("A")).instanceof(Error)
	expect(p.eval("AB")).instanceof(Error)
	expect(p.eval("ABC")).not.instanceof(Error)

	const p2 = asum(
		char("A").error(new MissingA()),
		char("B").error(new MissingB()),
		char("C").error(new MissingC()),
	)

	expect(p2.eval("D")).not.instanceOf(MissingA)
	expect(p2.eval("D")).not.instanceOf(MissingB)
	expect(p2.eval("D")).not.instanceOf(MissingC)
	expect(p2.eval("D")).instanceOf(Error)
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
		const begin = char("(")._$_(many(white))
		const applyInner = expr().and(many(some(white).$_(expr())))
		const end = many(white)._$_(char(")"))

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
