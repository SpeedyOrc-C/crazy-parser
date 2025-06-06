/*
A naïve implementation of JSON parser in pure JavaScript.
It's about a thousand times slower than the native one, so don't use it.
This is to prove the correctness of this library.
*/

import {
    Parser,
    asum,
    char,
    cr,
    digit,
    eof,
    hex,
    lazy,
    lf,
    Nothing,
    one,
    sequence,
    space,
    tab
} from "./index";
import {many, some} from "./prefix";
import * as V from "./void"

type MyJSON
    = boolean
    | number
    | null
    | string
    | Array<MyJSON>
    | { [key: string]: MyJSON }

const pWhitespace = many(asum(space, lf, cr, tab))

const pBoolean =
    V.str("true").cmap(true).or(V.str("false").cmap(false))

const pNull =
    V.str("null").cmap(null)

const pNumber =
    sequence(
        char("-").orPure(""),
        some(digit).where(digits => digits[0] != "0" || (digits[0] == "0" && digits.length == 1)),
        V.char(".").right(some(digit)).optional(),
        sequence(
            char("e").or(char("E")),
            char("+").or(char("-")).orPure(""),
            some(digit)).optional(),
    ).map(args =>
    {
        const [a0, a1_, a2_, a3_] = args

        const a1 = a1_.join("")

        const a2 = a2_ == Nothing ? "" : `.${a2_.join("")}`

        if (a3_ == Nothing)
            return parseFloat(`${a0}${a1}${a2}`)

        const [a30, a31, a32] = a3_

        return parseFloat(`${a0}${a1}${a2}${a30}${a31}${a32}`)
    })

const pString =
    V.char("\"").$_(many(
        V.char("\\").right(asum(
            V.char("\"").cmap("\""),
            V.char("\\").cmap("\\"),
            V.char("/").cmap("/"),
            V.char("b").cmap("\b"),
            V.char("f").cmap("\f"),
            V.char("n").cmap("\n"),
            V.char("r").cmap("\r"),
            V.char("t").cmap("\t"),
            V.char("u").right(hex.x(4)).map(ds => String.fromCodePoint(Number(`0x${ds.join("")}`))),
        )).or(one.where(c => c != "\""))
    ))._$(V.char("\"")).map(cs => cs.join(""))

const pValue =
    pWhitespace.$_(asum<MyJSON>(
        pString,
        pNumber,
        pBoolean,
        pNull,
        lazy(() => pObject),
        lazy(() => pArray),
    ))._$(pWhitespace)

const pArray: Parser<Array<MyJSON>> =
    V.char("[").$_(
        pValue.and(many(V.char(",").$_(pValue))).map(a => [a[0], ...a[1]])
            .orPure([]) // Note: The whitespace should've been consumed
    )._$(V.char("]"))

const pObjectEntry =
    pWhitespace.$_(pString.and(pWhitespace.$_(V.char(":")).$_(pValue)))

const pObject: Parser<{ [key: string]: MyJSON }> =
    V.char("{").$_(
        pObjectEntry.and(many(V.char(",").$_(pObjectEntry))).map(a => Object.fromEntries([a[0], ...a[1]]))
            .orPure({})
    )._$(V.char("}"))

export const json: Parser<any> = pValue._$(eof)
