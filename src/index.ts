export const Nothing: unique symbol = Symbol("Nothing")

export type State = {
	index: number
}

type Vector<A, Count extends number, TmpResult extends Array<A> = []> =
	TmpResult["length"] extends Count ? TmpResult : Vector<A, Count, [A, ...TmpResult]>

type MaybeJoined<T> = T | [T]

export class Parser<A, E extends Error = Error>
{
	constructor(
		public readonly f: (input: Uint32Array, state: State) => A | E
	)
	{}

	/*
	Replace the result of parser with a constant.
	The same as `<$` in Haskell.

	@param c - The constant
	@return A new parser that always returns that constant.
	*/
	cmap<B>(c: B): Parser<B, E>
	{
		return new Parser<B, E>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return result

			return c
		})
	}

	/*
	Modify the result of parser.
	Because every parser is a functor, similar to `map()` of lists.
	The same as `fmap` or `<$>` in Haskell.

	@param f - The modifier function, which takes parser's result and gives a new value.
	@return A new parser that returns the return value of the modifier function.
	*/
	map<B>(f: (a: A) => B): Parser<B, E>
	{
		return new Parser<B, E>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return result

			return f(result)
		})
	}

	/*
	If this parser failed, try the other one.
	Because every parser is an alternative.
	The same as `<|>` in Haskell.

	@param p - The other parser to try.
	@return A new parser that tries parser `p` if it failed.
	*/
	or<B, E2 extends Error>(p: Parser<B, E2>): Parser<A | B, E2>
	{
		return new Parser<A | B, E2>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return p.f(input, state)

			return result
		})
	}

	orPure<B>(c: B): Parser<A | B, any>
	{
		return new Parser<A | B, any>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return c

			return result
		})
	}

	/*
	Continue parsing with the result from the previous parser.
	Because every parser is a monad, similar to `flatMap()` of lists, `then()` of `Promise`s.
	The same as `>>=` in haskell.

	@param gf - The generator function that takes the result of the previous parser, and gives the next parser.
	@return A new parser that firstly tries the first one, and if it succeeded,
	the result is passed to `gf`, and the second parser will be what `gf` returns.
	*/
	bind<B, E2 extends Error>(gf: (a: A) => Parser<B, E2>): Parser<B, E | E2>
	{
		return new Parser<B, E | E2>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return result

			return gf(result).f(input, state)
		})
	}

	/*
	Combine two parsers into one.
	Because every parser is an applicative.
	The same as `<~>` in Parsec (a Haskell parser library).

	@param p - The other parser to be combined with.
	@return A new parser that firstly tries the first one, and if it succeeded, tries the second one.
	*/
	and<B, E2 extends Error>(p: Parser<B, E2>): Parser<[A, B], E | E2>
	{
		return this.bind(a => p.map(b => [a, b]))
	}

	/*
	Combine two parsers into one, **keep the result from the left**, reject the result from the right.
	The same as `<*` in Haskell.

	@param p - The other parser to be combined with.
	@return A new parser that only **keeps the result from the **left**.
	*/
	left<B, E2 extends Error>(p: Parser<B, E2>): Parser<A, E | E2>
	{
		return this.bind(a => p.map(_ => a))
	}

	/*
	Combine two parsers into one, **keep the result from the right**, reject the result from the left.
	The same as `*>` in Haskell.

	@param p - The other parser to be combined with.
	@return A nwe parser that only **keeps the result from the right**.
	*/
	right<B, E2 extends Error>(p: Parser<B, E2>): Parser<B, E | E2>
	{
		return this.bind(_ => p)
	}

	/*
	Try to use this parser as many as it can. **It won't fail** but gives an empty list if it didn't parse anything.
	The same as `many` in Haskell.

	@return A new parser that gives a list of results.
	*/
	many(): Parser<Array<A>, E>
	{
		return new Parser<Array<A>, E>((input, state) =>
		{
			const results: Array<A> = []

			while (true)
			{
				const result = this.f(input, state)

				if (result instanceof Error)
					break

				results.push(result)
			}

			return results
		})
	}

	/*
	Try to use this parser as many as it can. **It will fail** if it didn't parse anything.
	The same as `some` in Haskell.

	@return A new parser that gives a list of results.
	*/
	some(): Parser<Array<A>, E>
	{
		return this.many().bind(rs => rs.length > 0 ? pure(rs) : empty);
	}

	/*
	Haskell-style infix operator of `and()`.
	*/
	_$_<B, E2 extends Error>(p: Parser<B, E2>): Parser<[A, B], E | E2>
	{
		return this.and(p)
	}

	/*
	Haskell-style infix operator of `left()`.
	*/
	_$<B, E2 extends Error>(p: Parser<B, E2>): Parser<A, E | E2>
	{
		return this.left(p)
	}

	/*
	Haskell-style infix operator of `right()`.
	*/
	$_<B, E2 extends Error>(p: Parser<B, E2>): Parser<B, E | E2>
	{
		return this.right(p)
	}

	/*
	Let this parser fail if the condition is false.

	@param c - The condition
	@return A parser that immediately fails if the condition is false.
	*/
	if(c: boolean): Parser<A>
	{
		return c ? this : empty
	}

	/*
	Check if the result meets the requirement.

	@param c - The condition function that takes the result from the parser. If it returned true, the parsing succeeded.
	@return A new parser that fails if the result doesn't meet the requirement, even the parsing succeeded.
	*/
	where<E2 extends Error = Error>(c: (a: A) => boolean, e2: E2 = new Error() as E2): Parser<A, E | E2>
	{
		return new Parser<A, E | E2>((input, state) =>
		{
			const oldIndex = state.index

			const result = this.f(input, state)

			if (result instanceof Error)
				return result

			if (! c(result))
			{
				state.index = oldIndex
				return e2
			}

			return result
		})
	}

	/*
	Make a parser optional by allowing it to fail.
	The same as `optional` in Haskell.
	*/
	optional(): Parser<A | typeof Nothing, E>
	{
		return this.or(pure(Nothing))
	}

	/*
	Repeat the parser several times.

	@param n - The number of repetition.
	@return A new parser that gives a list of results based on how many times it repeated.
	If any of it failed, the whole one failed.
	*/
	x<N extends number>(n: N): Parser<Vector<A, N>, E>
	{
		if (n < 1)
			throw Error("Number of repetition must be greater than 1")

		const ps: Array<Parser<A, E>> = Array.from({length: n}, _ => this)

		return sequence(ps) as Parser<Vector<A, N>, E>
	}

	/*
	Append the index range to the result. This is useful in creating source-map.

	@return A new parser that gives a bi-tuple (result & range).
	*/
	withRange(): Parser<[A, [number, number]], E>
	{
		return new Parser<[A, [number, number]], E>((input, state) =>
		{
			const start = state.index

			const result = this.f(input, state)

			if (result instanceof Error)
				return result

			const end = state.index

			return [result, [start, end]]
		})
	}

	/*
	When this parser failed, rewind the cursor back to where it started.

	This function doesn't have a prefix version because `try` is a JavaScript keyword.

	@return A new parser that will rewind the cursor back to where it started if the parsing failed.
	*/
	try(): Parser<A, E>
	{
		return new Parser<A, E>((input, state) =>
		{
			const oldState = structuredClone(state)

			const result = this.f(input, state)

			if (result instanceof Error)
				state.index = oldState.index

			return result
		})
	}

	/*
	Override the error message of this parser.

	@param e - The new error message.
	@return A new parser that will throw this new error message.
	*/
	error<E2 extends Error>(e: E2): Parser<A, E2>
	{
		return new Parser<A, E2>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				return e

			return result
		})
	}

	/*
	Try to parse the given string.

	@param input - The string to be parsed.
	@return A tuple where the first one is the parsed result, if it succeeded. Or you'll get a `Fail` constant.
	The second one is the state that could reveal where the parser stopped.
	You should import `Fail` to check if it was successful.
	*/
	run(input: string): [A | E, State]
	{
		const buffer = Uint32Array.from(Array.from(input).map(c => c.codePointAt(0)))
		const state: State = {index: 0}
		const result = this.f(buffer, state)

		return [result, state]
	}

	/*
	Try to parse the given string.

	@param input - The string to be parsed.
	@return The parsed result if it succeeded. Or you'll get a `Fail` constant.
	*/
	eval(input: string): A | E
	{
		return this.run(input)[0]
	}

	/*
	Turn this parser into a promise.
	This is useful when you don't want to deal with our `Fail` constant.

	@param input - The string to be parsed.
	@return The promise version of `run()`.
	*/
	runPromise(input: string): Promise<[A, State]>
	{
		return new Promise((resolve, reject) =>
		{
			const [result, state] = this.run(input)

			if (result instanceof Error)
				reject(result)
			else
				resolve([result, state])
		})
	}

	/*
	Turn this parser into a promise.
	This is useful when you don't want to deal with our `Fail` constant.

	@param input - The string to be parsed.
	@return The promise version of `eval()`.
	*/
	evalPromise(input: string): Promise<A>
	{
		return new Promise((resolve, reject) =>
		{
			const result = this.eval(input)

			if (result instanceof Error)
				reject(result)
			else
				resolve(result)
		})
	}

	/*
	Show a message when the parser succeeded (WIN) or failed (BAD).
	Don't use is for dumping syntax tree or anything. Only use this for debugging purpose.

	@param message - The message to be shown.
	@return A new parser that will show the message when it succeeded or failed.
	*/
	trace(...message: Array<any>): Parser<A, E>
	{
		return new Parser<A, E>((input, state) =>
		{
			const result = this.f(input, state)

			if (result instanceof Error)
				console.error(`[crazy-parser] BAD`, result, ...message)
			else
				console.log(`[crazy-parser] WIN`, result, ...message)

			return result
		})
	}
}

/*
Lift a constant to a parser.
The same as `pure` or `return` in Haskell.

@param c - The constant
@return A parser that always gives that constant, without consuming any input string.
*/
export function pure<A>(c: A): Parser<A, any>
{
	return new Parser<A, any>(_ => c)
}

/*
The parser that always fails.
The same as `empty` in Haskell.
*/
export const empty: Parser<any> =
	new Parser<any, Error>(() => new Error())

/*
A convenient way to write a list of chained `or()`.
Similar to `race()` of Promise, but this is deterministic.
The same as `asum` in Haskell.

Before:
```ts
a.or(b).or(c).or(d)
```

Now:
```ts
asum([a, b, c, d])
```

@param ps - A list of parsers.
@return A new parser from combining parsers by `or()`.
*/
export function asum<A>
(...args: [Array<Parser<A, any>>]): Parser<A>
export function asum<A>
(...args: Array<Parser<A, any>>): Parser<A>
export function asum<A>
(...args: [Array<Parser<A, any>>] | Array<Parser<A, any>>): Parser<A>
{
	const ps = (args.length == 1 && args[0] instanceof Array) ? args[0] : args as
		Array<Parser<A, any>>

	if (ps.length == 0)
		return empty

	return ps.reduce((sum, p) => sum.or(p)).or(empty)
}

/*
A convenient way to write a list of chained `and()`, without being shocked by the nested bi-tuples.
Similar to `all()` of Promise.
The same as `sequence` in Haskell, but with more precise types thanks to the chaos of JavaScript.

@param ps - A list of parsers.
@return A new parser that tries the parsers one by one from left to right, and gives a list of their results.
If any of it failed, the whole one failed.
*/

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
>
(args: [Parser<A1, E1>, Parser<A2, E2>,]):
	Parser<[A1, A2], E1 | E2>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
>
(args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
]):
	Parser<[A1, A2, A3], E1 | E2 | E3>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
>
(args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
]):
	Parser<[A1, A2, A3, A4], E1 | E2 | E3 | E4>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
	A5, E5 extends Error,
>
(args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
	Parser<A5, E5>,
]):
	Parser<[A1, A2, A3, A4, A5], E1 | E2 | E3 | E4 | E5>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
	A5, E5 extends Error,
	A6, E6 extends Error,
>
(args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
	Parser<A5, E5>,
	Parser<A6, E6>,
]):
	Parser<[A1, A2, A3, A4, A5, A6], E1 | E2 | E3 | E4 | E5 | E6>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
>
(...args: [Parser<A1, E1>, Parser<A2, E2>,]):
	Parser<[A1, A2], E1 | E2>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
>
(...args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
]):
	Parser<[A1, A2, A3], E1 | E2 | E3>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
>
(...args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
]):
	Parser<[A1, A2, A3, A4], E1 | E2 | E3 | E4>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
	A5, E5 extends Error,
>
(...args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
	Parser<A5, E5>,
]):
	Parser<[A1, A2, A3, A4, A5], E1 | E2 | E3 | E4 | E5>

export function sequence<
	A1, E1 extends Error,
	A2, E2 extends Error,
	A3, E3 extends Error,
	A4, E4 extends Error,
	A5, E5 extends Error,
	A6, E6 extends Error,
>
(...args: [
	Parser<A1, E1>,
	Parser<A2, E2>,
	Parser<A3, E3>,
	Parser<A4, E4>,
	Parser<A5, E5>,
	Parser<A6, E6>,
]):
	Parser<[A1, A2, A3, A4, A5, A6], E1 | E2 | E3 | E4 | E5 | E6>

export function sequence<Ts extends Array<[any, Error]>>
(ps: { [I in keyof Ts]: Parser<Ts[I][0], Ts[I][1]> }):
	Parser<{ [I in keyof Ts]: Ts[I][0] }, Ts[number][1]>

export function sequence<Ts extends Array<[any, Error]>>
(...ps: { [I in keyof Ts]: Parser<Ts[I][0], Ts[I][1]> }):
	Parser<{ [I in keyof Ts]: Ts[I][0] }, Ts[number][1]>

export function sequence<Ts extends Array<[any, Error]>>
(...args: MaybeJoined<{ [I in keyof Ts]: Parser<Ts[I][0], Ts[I][1]> }>):
	Parser<{ [I in keyof Ts]: Ts[I][0] }, Ts[number][1]>
{
	const ps = args[0] instanceof Array ? args[0] : args

	return new Parser<{ [I in keyof Ts]: Ts[I][0] }, Ts[number][1]>((input, state) =>
	{
		const results: any[] = []

		for (const p of ps)
		{
			const result = p.f(input, state)

			if (result instanceof Error)
				return result

			results.push(result)
		}

		return results as Ts
	})
}

/*
Test if the parser has reached the end of file (string).
*/
export const eof = new Parser<unknown, Error>((input, state) =>
{
	if (state.index < input.length)
		return new Error()
})

/*
Consume one character from the input. Fail if it has reached the end of string.
*/
export const one = new Parser<string, Error>((input, state) =>
{
	if (state.index >= input.length)
		return new Error()

	const char = String.fromCodePoint(input[state.index])

	state.index += 1

	return char
})

/*
Parse a specific characters.

@params c - The character to be parsed.
*/
export function char<C extends string>(c: C): Parser<C>
{
	return new Parser<C, Error>((input, state) =>
	{
		if (state.index >= input.length)
			return new Error()

		const char = String.fromCodePoint(input[state.index])

		if (char != c)
			return new Error()

		state.index += 1

		return <C>char
	})
}

// Parse a digit (0~9).
export const digit =
	one.where(c => "0" <= c && c <= "9") as
		Parser<"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9">

// Parse an uppercase Latin letter without diacritics.
export const upper =
	one.where(c => "A" <= c && c <= "Z") as
		Parser<
			"A" | "B" | "C" | "D" | "E" | "F" | "G" |
			"H" | "I" | "J" | "K" | "L" | "M" | "N" |
			"O" | "P" | "Q" | "R" | "S" | "T" |
			"U" | "V" | "W" | "X" | "Y" | "Z">

// Parse a lowercase Latin letter without diacritics.
export const lower =
	one.where(c => "a" <= c && c <= "z") as
		Parser<
			"a" | "b" | "c" | "d" | "e" | "f" | "g" |
			"h" | "i" | "j" | "k" | "l" | "m" | "n" |
			"o" | "p" | "q" | "r" | "s" | "t" |
			"u" | "v" | "w" | "x" | "y" | "z">

// Parse a case-insensitive hexadecimal digit.
export const hex =
	digit.or(one.where(c => "A" <= c && c <= "F" || "a" <= c && c <= "f")) as
		Parser<
			"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" |
			"A" | "B" | "C" | "D" | "E" | "F" |
			"a" | "b" | "c" | "d" | "e" | "f">

// Parse a Latin letter without diacritics.
export const alpha = upper.or(lower)

// Parse a space.
export const space = char(" ")

// Parse a tab.
export const tab = char("\t")

// Parse a carriage return.
export const cr = char("\r")

// Parser a linefeed.
export const lf = char("\n")

// Parse the index which the parser is looking at.
export const index = new Parser<number, any>((_, state) => state.index)

/*
Parse a specific string.

@param s - The string to be parsed.
*/
export function str<S extends string>(s: S): Parser<S>
{
	const buffer = Uint32Array.from(Array.from(s).map(c => c.codePointAt(0)))

	return new Parser<S, Error>((input, state) =>
	{
		if (state.index + buffer.length > input.length)
			return new Error()

		for (let i = 0; i < buffer.length; i += 1)
			if (input[state.index + i] != buffer[i])
				return new Error()

		state.index += buffer.length

		return s
	})
}

export function span(f: (c: string) => boolean): Parser<Array<string>, any>
{
	return new Parser<Array<string>, any>((input, state) =>
	{
		let oldIndex = state.index

		while (state.index < input.length && f(String.fromCodePoint(input[state.index])))
			state.index += 1

		return Array.from(input.slice(oldIndex, state.index)).map(c => String.fromCodePoint(c)).join("")
	})
}

export function anyChar<Cs extends Array<string>>(cs: Cs): Parser<Cs[number]>
{
	return asum(cs.map(char))
}

export function anyStr<Ss extends Array<string>>(ss: Ss): Parser<Ss[number]>
{
	return asum(ss.map(str))
}

/*
Since JavaScript is a strictly evaluated language,
this makes it impossible for constants to refer to itself.
So all parsers refer to itself must be wrapped in a function that takes no arguments
(in Haskell, a function takes no arguments is totally the same as a constant).

But referring to itself will cause infinite recursion,
so you must use our `lazy()` wrapper to only evaluate the parser when it's needed.

So here's the full workaround, assume there's a self-referring parser `srp`:

Before:

```ts
const srp = f(srp)
```

After:

```ts
const srp =
    () => // 1st WRAP!
        lazy(() => // 2nd WRAP!
            f(srp()) // Call it!
        )
```
*/
export function lazy<P extends Parser<any, any>>(pg: () => P): P
{
	return new Parser((input, state) => pg().f(input, state)) as P
}

/*
A convenient way to intersperse parsers among string parsers.

Before:
```ts
sequence([str("123").right(a), str("456").right(b).left("789")])
```

After:
```ts
template`123${a}456${b}789`
```
*/
export function template<Ts extends Array<[any, any]>>
(ss: TemplateStringsArray, ...ps: { [I in keyof Ts]: Parser<Ts[I][0], Ts[I][1]> }): Parser<{ [I in keyof Ts]: Ts[I][0] }, Ts[number][1]>
{
	return sequence(ps.map((p, i) => str(ss[i]).right(p)) as { [I in keyof Ts]: Parser<Ts[I][0], Ts[I][1]> })
		.left(str(ss[ss.length - 1]))
}
