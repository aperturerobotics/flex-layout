export class Orientation {
    static HORZ = new Orientation("horz");
    static VERT = new Orientation("vert");

    static flip(from: Orientation) {
        return from === Orientation.HORZ ? Orientation.VERT : Orientation.HORZ;
    }

    /** @internal */
    private _name: string;

    /** @internal */
    private constructor(name: string) {
        this._name = name;
    }

    getName() {
        return this._name;
    }

    toString() {
        return this._name;
    }
}
