export abstract class Type<T> {
  constructor(
    protected readonly data: T
  ) { }
}

export abstract class Scalar<T> {
  constructor(
    protected readonly data: T
  ) { }
}

export class ValidationError extends Error { }
