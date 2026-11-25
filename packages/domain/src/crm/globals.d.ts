// TextDecoder exists in browsers, Node and Deno but isn't in the plain ES2022 type library this package uses.
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
