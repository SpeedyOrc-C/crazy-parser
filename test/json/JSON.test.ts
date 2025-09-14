import {json} from "../../src/json"
import {expect, test} from "vitest"
import {readFile} from "fs/promises"

test("Small", () =>
{
	expect(json.eval("1")).toBe(1)
	expect(json.eval("-1.2e3")).toBe(-1200)
	expect(json.eval("0.1")).toBe(0.1)
	expect(json.eval("true")).toBe(true)
	expect(json.eval("false")).toBe(false)
	expect(json.eval("null")).toBe(null)
	expect(json.eval("{}")).toStrictEqual({})
	expect(json.eval("[]")).toStrictEqual([])
})

test("Big", async () =>
{
	const raw = (await readFile("./test/json/allof.json")).toString()
	const my = json.eval(raw)
	expect(JSON.stringify(my, null, " ")).toBe(JSON.stringify(JSON.parse(raw), null, " "))
})

test("VERY BIG", async () =>
{
	const raw = (await readFile("./test/json/twitter.json")).toString()
	const my = json.eval(raw)
	expect(JSON.stringify(my, null, " ")).toBe(JSON.stringify(JSON.parse(raw), null, " "))
}, 10000)
