import {Parser} from "./index";

export function char(c: string): Parser<undefined>
{
    return new Parser<undefined, Error>((input, state) =>
    {
        if (state.index >= input.length)
            return new Error()

        const char = String.fromCodePoint(input[state.index])

        if (char != c)
            return new Error()

        state.index += 1
    })
}

export function str(s: string): Parser<undefined>
{
    const buffer = Uint32Array.from(Array.from(s).map(c => c.codePointAt(0)))

    return new Parser<undefined, Error>((input, state) =>
    {
        if (state.index + buffer.length > input.length)
            return new Error()

        for (let i = 0; i < buffer.length; i += 1)
            if (input[state.index + i] != buffer[i])
                return new Error()

        state.index += buffer.length
    })
}