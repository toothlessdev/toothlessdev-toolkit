import React, { ReactNode } from "react";
import { ExceptionCode, RuntimeException } from "./RuntimeException";

type OnExceptionArgs = {
  exception: RuntimeException | undefined;
  exceptionCode: ExceptionCode | undefined;
  resetException: () => void;
};

export interface RuntimeExceptionBoundaryProps {
  children?: React.ReactNode;
  onException?: (args: OnExceptionArgs) => ReactNode;
}

type ErrorBoundaryState = {
  exception?: RuntimeException;
  hasError: boolean;
};

export class RuntimeExceptionBoundary extends React.Component<
  RuntimeExceptionBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: Record<string, unknown>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    if (error instanceof RuntimeException) {
      return { hasError: true, exception: error };
    }
    return { hasError: true };
  }

  public componentDidCatch(error: Error) {
    if (error instanceof RuntimeException) {
      console.error(
        "RuntimeException caught:",
        error.exceptionCode,
        error.message,
      );
    } else {
      console.error("Unknown error caught:", error);
    }
  }

  resetException = () => {
    this.state = {
      hasError: false,
      exception: undefined,
    };
  };

  render() {
    if (this.state.hasError) {
      if (this.props.onException) {
        return this.props.onException({
          exception: this.state.exception,
          exceptionCode: this.state.exception?.exceptionCode,
          resetException: this.resetException,
        });
      }
      return `예외 발생 : ${this.state.exception?.exceptionCode}`;
    }
    return this.props.children;
  }
}
