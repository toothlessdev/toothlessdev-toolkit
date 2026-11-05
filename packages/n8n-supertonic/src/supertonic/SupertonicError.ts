export class SupertonicError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

export class InvalidSupertonicRequestError extends SupertonicError {}

export class SupertonicFailedError extends SupertonicError {}

export class SupertonicTimedOutError extends SupertonicError {}

export class SupertonicCancelledError extends SupertonicError {}
