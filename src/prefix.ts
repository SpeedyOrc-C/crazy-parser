import Parser from "./index";

export function optional<A>(p: Parser<A>) { return p.optional() }

export function withRange<A>(p: Parser<A>) { return p.withRange() }

export function many<A>(p: Parser<A>) { return p.many() }

export function some<A>(p: Parser<A>) { return p.some() }
