/**
 * Déclarations de types minimales pour argon2-browser (la dépendance ne fournit pas
 * de types complets pour l'API `hash` utilisée ici).
 */
declare module "argon2-browser" {
  export enum ArgonType {
    Argon2d = 0,
    Argon2i = 1,
    Argon2id = 2,
  }

  export interface HashOptions {
    pass: string;
    salt: string;
    time?: number;
    mem?: number;
    hashLen?: number;
    parallelism?: number;
    type?: ArgonType;
  }

  export interface HashResult {
    hash: string;
    hashLen: number;
    encoded: string;
  }

  export function hash(options: HashOptions): Promise<HashResult>;
}
