import Parser, {
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
    pure,
    sequence,
    space,
    str,
    tab
} from "./index";
import {many, some} from "./prefix";

type MyJSON
    = boolean
    | number
    | null
    | string
    | Array<MyJSON>
    | { [key: string]: MyJSON }

const pWhitespace = many(asum(space, lf, cr, tab))

const pBoolean =
    str("true").cmap(true).or(str("false").cmap(false))

const pNull =
    str("null").cmap(null)

const pNumber =
    sequence(
        char("-").or(pure("")),
        some(digit).where(digits => digits[0] != "0" || (digits[0] == "0" && digits.length == 1)),
        char(".").right(some(digit)).optional(),
        sequence(
            char("e").or(char("E")),
            char("+").or(char("-")).or(pure("")),
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
    char("\"").$_(many(
        char("\\").right(asum(
            char("\"").cmap("\""),
            char("\\").cmap("\\"),
            char("/").cmap("/"),
            char("b").cmap("\b"),
            char("f").cmap("\f"),
            char("n").cmap("\n"),
            char("r").cmap("\r"),
            char("t").cmap("\t"),
            char("u").right(hex.x(4)).map(ds => String.fromCodePoint(Number(`0x${ds.join("")}`))),
        )).or(one.where(c => c != "\""))
    ))._$(char("\"")).map(cs => cs.join(""))

const pValue = lazy(() =>
    pWhitespace.$_(asum<MyJSON>(
        pNull,
        pBoolean,
        pString,
        pNumber,
        pArray,
        pObject
    ))._$(pWhitespace)
)

const pArray: Parser<Array<MyJSON>> =
    char("[").$_(
        pValue.and(many(char(",").$_(pValue))).map(a => [a[0], ...a[1]])
            .or(pure([])) // Note: The whitespace should've been consumed
    )._$(char("]"))


const pObjectEntry =
    pWhitespace.$_(pString.and(pWhitespace.$_(char(":")).$_(pValue)))

const pObject: Parser<{ [key: string]: MyJSON }> =
    char("{").$_(
        pObjectEntry.and(many(char(",").$_(pObjectEntry))).map(a => Object.fromEntries([a[0], ...a[1]]))
            .or(pure({}))
    )._$(char("}"))

export const json: Parser<any> = pValue._$(eof)
