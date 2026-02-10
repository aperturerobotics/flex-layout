import { Component, ErrorInfo, ReactNode } from "react";
import { CLASSES } from "../Types";

/** @internal */
export interface IErrorBoundaryProps {
    message: string;
    children: ReactNode;
}
/** @internal */
export interface IErrorBoundaryState {
    hasError: boolean;
}

/** @internal */
export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
    constructor(props: IErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_error: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.debug(error);
        console.debug(errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className={CLASSES.FLEXLAYOUT__ERROR_BOUNDARY_CONTAINER}>
                    <div className={CLASSES.FLEXLAYOUT__ERROR_BOUNDARY_CONTENT}>{this.props.message}</div>
                </div>
            );
        }

        return this.props.children;
    }
}
