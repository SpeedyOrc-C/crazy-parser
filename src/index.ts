export const Fail: unique symbol = Symbol("Parser Failure")
export const Nothing: unique symbol = Symbol("Nothing")

export type State = {
    index: number
}

type Vector<A, Count extends number, TmpResult extends Array<A> = []> =
    TmpResult["length"] extends Count ? TmpResult : Vector<A, Count, [A, ...TmpResult]>

export default class Parser<A>
{
    constructor(
        public readonly f: (input: Array<string>, state: State) => A | typeof Fail
    )
    {}

    /*
    Replace the result of parser with a constant.
    The same as `<$` in Haskell.

    @param c - The constant
    @return A new parser that always returns that constant.
    */
    cmap<B>(c: B): Parser<B>
    {
        return new Parser<B>((input, state) =>
        {
            const result = this.f(input, state)

            if (result == Fail)
                return Fail

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
    map<B>(f: (a: A) => B): Parser<B>
    {
        return new Parser<B>((input, state) =>
        {
            const result = this.f(input, state)

            if (result == Fail)
                return Fail

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
    or<B>(p: Parser<B>): Parser<A | B>
    {
        return new Parser<A | B>((input, state) =>
        {
            const result = this.f(input, state)

            if (result != Fail)
                return result

            return p.f(input, state)
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
    bind<B>(gf: (a: A) => Parser<B>): Parser<B>
    {
        return new Parser<B>((input, state) =>
        {
            const result = this.f(input, state)

            if (result == Fail)
                return Fail

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
    and<B>(p: Parser<B>): Parser<[A, B]>
    {
        return this.bind(a => p.map(b => [a, b]))
    }

    /*
    Combine two parsers into one, **keep the result from the left**, reject the result from the right.
    The same as `<*` in Haskell.

    @param p - The other parser to be combined with.
    @return A new parser that only **keeps the result from the **left**.
    */
    left<B>(p: Parser<B>): Parser<A>
    {
        return this.bind(a => p.map(_ => a))
    }

    /*
    Combine two parsers into one, **keep the result from the right**, reject the result from the left.
    The same as `*>` in Haskell.

    @param p - The other parser to be combined with.
    @return A nwe parser that only **keeps the result from the right**.
    */
    right<B>(p: Parser<B>): Parser<B>
    {
        return this.bind(_ => p)
    }

    /*
    Try to use this parser as many as it can. **It won't fail** but gives an empty list if it didn't parse anything.
    The same as `many` in Haskell.

    @return A new parser that gives a list of results.
    */
    many(): Parser<Array<A>>
    {
        return new Parser<Array<A>>((input, state) =>
        {
            const result: Array<A> = []

            while (true)
            {
                const r = this.f(input, state)

                if (r == Fail)
                    break

                result.push(r)
            }

            return result
        })
    }

    /*
    Try to use this parser as many as it can. **It will fail** if it didn't parse anything.
    The same as `some` in Haskell.

    @return A new parser that gives a list of results.
    */
    some(): Parser<Array<A>>
    {
        return this.many().bind(rs => rs.length > 0 ? pure(rs) : empty);
    }

    /*
    Haskell-style infix operator of `and()`.
    */
    _$_<B>(p: Parser<B>): Parser<[A, B]>
    {
        return this.and(p)
    }

    /*
    Haskell-style infix operator of `left()`.
    */
    _$<B>(p: Parser<B>): Parser<A>
    {
        return this.left(p)
    }

    /*
    Haskell-style infix operator of `right()`.
    */
    $_<B>(p: Parser<B>): Parser<B>
    {
        return this.right(p)
    }

    if <C extends boolean>(c: boolean): Parser<C extends true ? A : any>
    {
        return c ? this : empty
    }

    /*
    Check if the result meets the requirement.

    @param c - The condition function that takes the result from the parser. If it returned true, the parsing succeeded.
    @return A new parser that fails if the result doesn't meet the requirement, even the parsing succeeded.
    */
    where(c: (a: A) => boolean): Parser<A>
    {
        return new Parser((input, state) =>
        {
            const result = this.f(input, state)

            if (result != Fail && !c(result))
                return Fail

            return result
        })
    }

    /*
    Make a parser optional by allowing it to fail.
    The same as `optional` in Haskell.
    */
    optional(): Parser<A | typeof Nothing>
    {
        return this.or(pure(Nothing))
    }

    /*
    Repeat the parser several times.

    @param n - The number of repetition.
    @return A new parser that gives a list of results based on how many times it repeated.
    If any of it failed, the whole one failed.
    */
    x<N extends number>(n: N): Parser<Vector<A, N>>
    {
        if (n < 1)
            throw Error("Number of repetition must be greater than 1")

        const ps: Array<Parser<A>> = Array.from({length: n}, _ => this)

        return sequence(ps) as Parser<Vector<A, N>>
    }

    /*
    Append the index range to the result. This is useful in creating source-map.

    @return A new parser that gives a bi-tuple (result & range).
    */
    withRange(): Parser<[A, [number, number]]>
    {
        return new Parser<[A, [number, number]]>((input, state) =>
        {
            const start = state.index

            const result = this.f(input, state)

            if (result == Fail)
                return Fail

            const end = state.index

            return [result, [start, end]]
        })
    }

    /*
    When this parser failed, rewind the cursor back to where it started.

    This function doesn't have a prefix version because `try` is a JavaScript keyword.

    @return A new parser that will rewind the cursor back to where it started if the parsing failed.
    */
    try(): Parser<A>
    {
        return new Parser<A>((input, state) =>
        {
            const oldState = structuredClone(state)

            const result = this.f(input, state)

            if (result == Fail)
                state.index = oldState.index

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
    run(input: string): [A | typeof Fail, State]
    {
        const state: State = {index: 0}

        const result = this.f(Array.from(input), state)

        if (result == Fail)
            return [Fail, state]

        return [result, state]
    }

    /*
    Try to parse the given string.

    @param input - The string to be parsed.
    @return The parsed result if it succeeded. Or you'll get a `Fail` constant.
    */
    eval(input: string): A | typeof Fail
    {
        const [result] = this.run(input)

        if (result == Fail)
            return Fail

        return result
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

            if (result == Fail)
            {
                reject("Parsing failed.")
                return
            }

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

            if (result == Fail)
            {
                reject("Parsing failed.")
                return
            }

            resolve(result)
        })
    }

    /*
    Show a message when the parser succeeded (WIN) or failed (BAD).
    Don't use is for dumping syntax tree or anything. Only use this for debugging purpose.

    @param message - The message to be shown.
    @return A new parser that will show the message when it succeeded or failed.
    */
    trace(message: any = ""): Parser<A>
    {
        return new Parser<A>((input, state) =>
        {
            const result = this.f(input, state)

            if (result == Fail)
            {
                console.error(`[crazy-parser] BAD`, message)
                return Fail
            }

            console.log(`[crazy-parser] WIN`, message)
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
export function pure<A>(c: A): Parser<A>
{
    return new Parser<A>(_ => c)
}

/*
The parser that always fails.
The same as `empty` in Haskell.
*/
export const empty = new Parser<any>(() => Fail)

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
export function asum<Ts extends Array<any>>
(ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts[number]>
{
    if (ps.length == 0)
        return empty

    return ps.reduce((sum, p) => sum.or(p))
}

/*
A convenient way to write a list of chained `and()`, without being shocked by the nested bi-tuples.
Similar to `all()` of Promise.
The same as `sequence` in Haskell, but with more precise types thanks to the chaos of JavaScript.

@param ps - A list of parsers.
@return A new parser that tries the parsers one by one from left to right, and gives a list of their results.
If any of it failed, the whole one failed.
*/
export function sequence<Ts extends Array<any>>
(ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts>
{
    return new Parser<Ts>((input, state) =>
    {
        const results: any[] = []

        for (const p of ps)
        {
            const result = p.f(input, state)

            if (result == Fail)
                return Fail

            results.push(result)
        }

        return results as Ts
    })
}

/*
Test if the parser has reached the end of file (string).
*/
export const eof = new Parser<unknown>((input, state) =>
{
    if (state.index < input.length)
        return Fail
})

/*
Consume one character from the input. Fail if it has reached the end of string.
*/
export const one = new Parser<string>((input, state) =>
{
    if (state.index >= input.length)
        return Fail

    const char = input[state.index]

    state.index += 1

    return char
})

/*
Parse a specific characters.

@params c - The character to be parsed.
*/
export function char<C extends string>(c: C): Parser<C>
{
    return new Parser<C>((input, state) =>
    {
        if (state.index >= input.length)
            return Fail

        const char = input[state.index]

        if (char != c)
            return Fail

        state.index += 1

        return <C>char
    })
}

/*
Parse a digit (0~9).
*/
export const digit =
    asum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(char))

/*
Parse an uppercase Latin letter without diacritics.
*/
export const upper =
    asum([
        "A", "B", "C", "D", "E", "F", "G",
        "H", "I", "J", "K", "L", "M", "N",
        "O", "P", "Q", "R", "S", "T",
        "U", "V", "W", "X", "Y", "Z"].map(char))

/*
Parse a lowercase Latin letter without diacritics.
*/
export const lower =
    asum([
        "a", "b", "c", "d", "e", "f", "g",
        "h", "i", "j", "k", "l", "m", "n",
        "o", "p", "q", "r", "s", "t",
        "u", "v", "w", "x", "y", "z"].map(char))

/*
Parse a Latin letter without diacritics.
*/
export const alpha = upper.or(lower)

/*
Parse a space.
*/
export const space = char(" ")

/*
Parse a tab.
*/
export const tab = char("\t")

/*
Parse the index which the parser is looking at.
*/
export const index = new Parser<number>((_, state) => state.index)

/*
Parse a specific string.

@param s - The string to be parsed.
*/
export function str<S extends string>(s: S): Parser<S>
{
    const cs = Array.from(s)

    return new Parser<S>((input, state) =>
    {
        if (state.index + cs.length > input.length)
            return Fail

        for (let i = 0; i < cs.length; i += 1)
            if (input[state.index + i] != cs[i])
                return Fail

        state.index += cs.length

        return s
    })
}

export function span(f: (c: string) => boolean): Parser<Array<string>>
{
    return new Parser<Array<string>>((input, state) =>
    {
        let oldIndex = state.index

        while (state.index < input.length && f(input[state.index]))
            state.index += 1

        return input.slice(oldIndex, state.index)
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
export function lazy<A>(pg: () => Parser<A>): Parser<A>
{
    return new Parser((input, state) => pg().f(input, state))
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
export function template<Ts extends Array<any>>
(ss: TemplateStringsArray, ...ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts>
{
    const sum: Array<Parser<any>> = []

    for (const i in ps)
        sum.push(str(ss[i]).right(ps[i]))

    return sequence(sum).left(str(ss[ss.length - 1])) as Parser<Ts>
}
