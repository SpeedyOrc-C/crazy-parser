export type TParser<T> = (input: string) => Promise<[T, string]>;
export const map = <A, B>(p: TParser<A>, f: (a: A) => B): TParser<B> => (input: string) =>
    p(input).then(([a, rest]) => [f(a), rest]);

export const alt = <T>(p1: TParser<T>, p2: TParser<T>): TParser<T> => (input: string) =>
    p1(input).catch(() => p2(input));

export const alts = <T>(...ps: TParser<T>[]) => async (input: string): Promise<[T, string]> =>
{
    if (ps.length == 1)
        return ps[0](input);
    else
        try {
            return await ps[0](input);
        } catch {
            return await alts(...ps.slice(1))(input);
        }
};

export const some = <T>(p: TParser<T>): TParser<T[]> => (input: string) => new Promise((just, _) =>
{
    const results: T[] = [];
    const loop = (input: string) =>
        p(input)
            .then(([result, rest]) =>
            {
                results.push(result);
                loop(rest);
            })
            .catch(() => just([results, input]));

    loop(input);
});

export const many = <T>(p: TParser<T>): TParser<T[]> => (input: string) => new Promise((just, nothing) =>
{
    const results: T[] = [];
    const loop = (input: string) =>
        p(input)
            .then(([result, rest]) =>
            {
                results.push(result);
                loop(rest);
            })
            .catch(() => results.length > 0 ? just([results, input]) : nothing());

    loop(input);
});

export const pred = (p: (input: string) => boolean): TParser<string> => (input: string) => new Promise((just, nothing) =>
{
    if (input.length > 0 && p(input[0]))
        just([input[0], input.slice(1)]);
    else
        nothing();
});

export const span = (p: (char: string) => boolean): TParser<string> => (input: string) => new Promise((just, nothing) =>
{
    let length = 0;

    while (length < input.length && p(input[length]))
        length += 1;

    if (length > 0)
        just([input.slice(0, length), input.slice(length)]);
    else
        nothing();
});

export const opt = <T>(p: TParser<T>): TParser<T | null> => (s: string) => p(s).catch(() => [null, s]);

export const str = (char: string) => (input: string): Promise<[string, string]> => new Promise((just, nothing) =>
{
    if (input.startsWith(char))
        just([char, input.slice(char.length)]);
    else
        nothing();
});

export default class Parser
{
    static map = map;
    static alt = alt;
    static alts = alts;
    static some = some;
    static many = many;
    static pred = pred;
    static span = span;
    static opt = opt;
    static str = str;
}
