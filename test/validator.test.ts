import {assert, test} from "vitest"

import {array, bool, nil, num, obj, str, sequence, asum, eq} from "../src/json/validate"

test("Boolean", () =>
{
	assert(! (bool(true) instanceof TypeError))
	assert(! (bool(false) instanceof TypeError))

	assert(bool(42) instanceof TypeError)
	assert(bool("foo") instanceof TypeError)
	assert(bool(null) instanceof TypeError)
	assert(bool([]) instanceof TypeError)
	assert(bool({}) instanceof TypeError)
})

test("Number", () =>
{
	assert(! (num(42) instanceof TypeError))
	assert(! (num(3.14) instanceof TypeError))

	assert(num(true) instanceof TypeError)
	assert(num("foo") instanceof TypeError)
	assert(num(null) instanceof TypeError)
	assert(num([]) instanceof TypeError)
	assert(num({}) instanceof TypeError)
})

test("String", () =>
{
	assert(! (str("foo") instanceof TypeError))
	assert(! (str("") instanceof TypeError))

	assert(str(42) instanceof TypeError)
	assert(str(true) instanceof TypeError)
	assert(str(null) instanceof TypeError)
	assert(str([]) instanceof TypeError)
	assert(str({}) instanceof TypeError)
})

test("Null", () =>
{
	assert(! (nil(null) instanceof TypeError))

	assert(nil(42) instanceof TypeError)
	assert(nil(true) instanceof TypeError)
	assert(nil("foo") instanceof TypeError)
	assert(nil([]) instanceof TypeError)
	assert(nil({}) instanceof TypeError)
})

test("Array", () =>
{
	const f = array(num)

	assert(! (f([]) instanceof TypeError))
	assert(! (f([1, 2, 3]) instanceof TypeError))
	assert(! (f([-1, 0, 3.14]) instanceof TypeError))

	assert(f([1, 2, "foo"]) instanceof TypeError)
	assert(f([1, 2, null]) instanceof TypeError)
	assert(f([1, 2, []]) instanceof TypeError)
	assert(f([1, 2, {}]) instanceof TypeError)
	assert(f(["1", "2", "3"]) instanceof TypeError)

	assert(f("foo") instanceof TypeError)
	assert(f(42) instanceof TypeError)
	assert(f(true) instanceof TypeError)
	assert(f(null) instanceof TypeError)
	assert(f({}) instanceof TypeError)
})

type IStudent = {
	name: string
	age: number
	parents: string[]
}

const studentsCorrect: IStudent[] = [
	{name: "Alice", age: 12, parents: ["Bob", "Carol"]},
	{name: "David", age: 10, parents: ["Eve", "Frank"]},
]

const studentsIncorrect = [
	{name: "Alice", age: 12, parents: ["Bob", "Carol"]},
	{name: "David", age: "10", parents: ["Eve", "Frank"]}, // age should be number
]

test("Object", () =>
{
	const student = obj({
		name: str,
		age: num,
		parents: array(str),
	})

	const f = array(student)

	assert(! (f(studentsCorrect) instanceof TypeError))

	assert(f(studentsIncorrect) instanceof TypeError)

	assert(f("foo") instanceof TypeError)
	assert(f(42) instanceof TypeError)
	assert(f(true) instanceof TypeError)
	assert(f(null) instanceof TypeError)
	assert(student([]) instanceof TypeError)
})

test("Sequence", () =>
{
	const f = sequence(str, num, array(str))

	assert(! (f(["foo", 42, ["bar", "baz"]]) instanceof TypeError))

	assert(f([42, 42, ["bar", "baz"]]) instanceof TypeError)
	assert(f(["foo", "foo", ["bar", "baz"]]) instanceof TypeError)
	assert(f(["foo", 42, [42, "baz"]]) instanceof TypeError)
})

test("Sum of Alternatives", () =>
{
	const f = asum(str, num, nil)

	assert(! (f("foo") instanceof TypeError))
	assert(! (f(42) instanceof TypeError))
	assert(! (f(null) instanceof TypeError))

	assert(f(true) instanceof TypeError)
	assert(f([]) instanceof TypeError)
	assert(f({}) instanceof TypeError)
})

test("Equal", () =>
{
	assert(! (eq(42)(42) instanceof TypeError))
	assert(! (eq("foo")("foo") instanceof TypeError))
	assert(! (eq(true)(true) instanceof TypeError))
	assert(! (eq(null)(null) instanceof TypeError))

	assert(eq(42)(43) instanceof TypeError)
	assert(eq("foo")("bar") instanceof TypeError)
	assert(eq(true)(false) instanceof TypeError)
	assert(eq(null)(0) instanceof TypeError)
})
