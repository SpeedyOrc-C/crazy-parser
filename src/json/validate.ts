export type Validator<A, I = unknown, E extends TypeError = TypeError> =
	(input: I) => A | E

export const str: Validator<string> = input =>
{
	if (typeof input != "string")
		return new TypeError(`Expected string, got ${JSON.stringify(input)}`)

	return input
}

export const num: Validator<number> = (input =>
{
	if (typeof input != "number")
		return new TypeError(`Expected number, got ${JSON.stringify(input)}`)

	return input
})

export const bool: Validator<boolean> = input =>
{
	if (typeof input != "boolean")
		return new TypeError(`Expected boolean, got ${JSON.stringify(input)}`)

	return input
}

export const nil: Validator<null> = input =>
{
	if (input !== null)
		return new TypeError(`Expected null, got ${JSON.stringify(input)}`)

	return null
}

export const array: <A>(inner: Validator<A>) => Validator<A[]> = inner => input =>
{
	if (! Array.isArray(input))
		return new TypeError(`Expected array, got ${JSON.stringify(input)}`)

	for (let i in input)
	{
		const item = input[i]

		const result = inner(item)

		if (result instanceof TypeError)
			return new TypeError(`Invalid index ${i}: ${result.message}`)
	}

	return input
}

export const obj: <Vs extends Record<string, any>>(inner: { [k in keyof Vs]: Validator<Vs[k]> }) => Validator<{ [i in keyof Vs]: Vs[i] }> = (inner) => input =>
{
	if (typeof input != "object" || input === null || Array.isArray(input))
		return new TypeError(`Expected object, got ${JSON.stringify(input)}`)

	for (const key in inner)
	{
		const validator = inner[key]

		if (! (key in input))
			return new TypeError(`Missing key: ${key}`)

		const result = validator((input as any)[key])

		if (result instanceof TypeError)
			return new TypeError(`Invalid key ${key}: ${result.message}`)
	}

	return input as any
}

export const sequence: <Ts extends any[]>(...inners: { [k in keyof Ts]: Validator<Ts[k]> }) => Validator<Ts> = (...inners) => input =>
{
	if (! Array.isArray(input))
		return new TypeError(`Expected tuple, got ${JSON.stringify(input)}`)

	if (input.length != inners.length)
		return new TypeError(`Expected tuple of length ${inners.length}, got ${JSON.stringify(input)}`)

	for (const i in inners)
	{
		const validator = inners[i]
		const item = input[i]

		const result = validator(item)

		if (result instanceof TypeError)
			return new TypeError(`Invalid index ${i}: ${result.message}`)
	}

	return input as any
}

export const asum: <Ts extends any[]>(...inners: { [k in keyof Ts]: Validator<Ts[k]> }) => Validator<Ts[number]> = (...inners) => input =>
{
	const errors: TypeError[] = []

	for (const validator of inners)
	{
		const result = validator(input)

		if (result instanceof TypeError)
			errors.push(result)
		else
			return result
	}

	return new TypeError(`No alternatives matched, got errors: ${errors.map(e => e.message).join("; ")}`)
}

type Ands<Ts extends any[]> =
	Ts extends [infer Head, ...infer Tail]
		? Head & Ands<Tail>
		: unknown

export const ands: <Ts extends any[]>(...inners: { [k in keyof Ts]: Validator<Ts[k]> }) => Validator<Ands<Ts>> = (...inners) => input =>
{
	for (const i in inners)
	{
		const validator = inners[i]
		const result = validator(input)

		if (result instanceof TypeError)
			return new TypeError(`Failed at step ${i}: ${result.message}`)
	}

	return input as any
}

export const eq: <A>(value: A) => Validator<A> = value => input =>
{
	if (input !== value)
		return new TypeError(`Expected ${JSON.stringify(value)}, got ${JSON.stringify(input)}`)

	return value
}

export const where: <A, NewA extends A = A>(
	validator: Validator<A>,
	predicate: (a: A) => boolean,
	error?: TypeError,
) => Validator<NewA> = (validator, predicate, error) => input =>
{
	const result = validator(input)

	if (result instanceof TypeError)
		return result

	if (! predicate(result))
		return error ?? new TypeError(`Value did not satisfy predicate, got ${JSON.stringify(result)}`)

	return result as any
}
