export const Fail = Symbol()

export type TFail = typeof Fail

export type State = {
    index: number
}

export class Parser<A>
{
    constructor(
        public readonly f: (input: Array<string>, state: State) => A | TFail
    )
    {}

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

    _$_<B>(p: Parser<B>): Parser<[A, B]>
    {
        return this.bind(a => p.map(b => [a, b]))
    }

    and<B>(p: Parser<B>): Parser<[A, B]>
    {
        return this._$_(p)
    }

    left<B>(p: Parser<B>): Parser<A>
    {
        return this._$(p)
    }

    _$<B>(p: Parser<B>): Parser<A>
    {
        return this.bind(a => p.map(_ => a))
    }

    right<B>(p: Parser<B>): Parser<B>
    {
        return this.$_(p)
    }

    $_<B>(p: Parser<B>): Parser<B>
    {
        return this.bind(_ => p)
    }

    where(c: (a: A) => boolean): Parser<A>
    {
        return new Parser((input, state) =>
        {
            const result = this.f(input, state)

            if (result == Fail)
                return Fail

            if (!c(result))
                return Fail

            return result
        })
    }

    x(n: number): Parser<Array<A>>
    {
        if (n < 1)
            throw Error("Number of repetition must be greater than 1")

        const ps: Array<Parser<A>> = []

        for (let i = 0; i < n; i += 1)
        {
            ps.push(this)
        }

        return sequence(ps)
    }

    parse(input: string): [A, State] | TFail
    {
        const state: State = {index: 0}

        const result = this.f(Array.from(input), state)

        if (result == Fail)
            return Fail

        return [result, state]
    }
}

export function pure<A>(a: A): Parser<A>
{
    return new Parser<A>(_ => a)
}

export const empty = new Parser<any>(() => Fail)

export function asum<Ts extends Array<any>>
(ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts[number]>
{
    if (ps.length == 0)
        return empty

    return ps.reduce((sum, p) => sum.or(p))
}

export function sequence<Ts extends Array<any>>
(ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts>
{
    return new Parser<Ts>((input, state) =>
    {
        const oldIndex = state.index

        const results: any[] = []

        for (const p of ps)
        {
            const result = p.f(input, state)

            if (result == Fail)
            {
                state.index = oldIndex
                return Fail
            }

            results.push(result)
        }

        return results as Ts
    })
}

export const eof = new Parser<unknown>((input, state) =>
{
    if (input.length < state.index)
        return Fail
})

export const one = new Parser<string>((input, state) =>
{
    if (state.index >= input.length)
        return Fail

    const char = input[state.index]

    state.index += 1

    return char
})

export function char<A extends string>(c: A): Parser<A>
{
    return new Parser<A>((input, state) =>
    {
        if (state.index >= input.length)
            return Fail

        const char = input[state.index]

        if (char != c)
            return Fail

        state.index += 1

        return <A>char
    })
}

export const digit =
    asum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(char))

export const upper =
    asum([
        "A", "B", "C", "D", "E", "F", "G",
        "H", "I", "J", "K", "L", "M", "N",
        "O", "P", "Q", "R", "S", "T",
        "U", "V", "W", "X", "Y", "Z"].map(char))

export const lower =
    asum([
        "a", "b", "c", "d", "e", "f", "g",
        "h", "i", "j", "k", "l", "m", "n",
        "o", "p", "q", "r", "s", "t",
        "u", "v", "w", "x", "y", "z"].map(char))

export const alpha = upper.or(lower)

export const space = char(" ")

export const tab = char("\t")

export const index = new Parser<number>((_, state) => state.index)

export function withRange<A>(p: Parser<A>): Parser<[A, [number, number]]>
{
    return new Parser<[A, [number, number]]>((input, state) =>
    {
        const start = state.index

        const result = p.f(input, state)

        if (result == Fail)
            return Fail

        const end = state.index

        return [result, [start, end]]
    })
}

export function str(s: string): Parser<string>
{
    const cs = Array.from(s)

    return new Parser<string>((input, state) =>
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
        let index = state.index

        while (index < input.length && f(input[index]))
            index += 1

        const result = input.slice(state.index, index)

        state.index = index

        return result
    })
}

export function many<A>(p: Parser<A>): Parser<Array<A>>
{
    return new Parser<Array<A>>((input, state) =>
    {
        const result: Array<A> = []

        while (true)
        {
            const r = p.f(input, state)

            if (r == Fail)
                break

            result.push(r)
        }

        return result
    })
}

export const some =
    <A>(p: Parser<A>): Parser<Array<A>> => many(p).bind(rs => rs.length > 0 ? pure(rs) : empty);

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

export function template<Ts extends Array<any>>
(ss: TemplateStringsArray, ...ps: { [I in keyof Ts]: Parser<Ts[I]> }): Parser<Ts>
{
    const sum: Array<Parser<any>> = []

    for (const i in ps)
        sum.push(str(ss[i]).right(ps[i]))

    return sequence(sum).left(str(ss[ss.length - 1])) as Parser<Ts>
}
