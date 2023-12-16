import {Attribute, IBaseNode, Tag} from "./HTML";

export function div(attributes: [string, string][] = [], children: IBaseNode[] = []): Tag
{
    return new Tag("div", attributes.map(([k, v]) => new Attribute(k, v)), children)
}
