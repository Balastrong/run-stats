import type { RunSource } from "./types.ts";

export class SourceRegistry {
  readonly #sources = new Map<string, RunSource>();

  register(source: RunSource): this {
    if (this.#sources.has(source.id)) {
      throw new Error(`Run source '${source.id}' is already registered`);
    }
    this.#sources.set(source.id, source);
    return this;
  }

  get(id: string): RunSource {
    const source = this.#sources.get(id);
    if (!source) {
      throw new Error(
        `Unknown run source '${id}'. Available: ${this.ids().join(", ")}`,
      );
    }
    return source;
  }

  ids(): string[] {
    return [...this.#sources.keys()];
  }
}
