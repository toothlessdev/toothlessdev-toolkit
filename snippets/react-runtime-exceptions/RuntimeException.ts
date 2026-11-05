export type ExceptionCode = number | string;

export type RuntimeExceptionConstructorArgs = {
  exceptionCode: ExceptionCode;
  message: string;
};

export class RuntimeException extends Error {
  readonly exceptionCode: number | string;

  constructor(args: RuntimeExceptionConstructorArgs) {
    super(args.message);
    this.name = this.constructor.name;
    this.exceptionCode = args.exceptionCode;
  }
}
