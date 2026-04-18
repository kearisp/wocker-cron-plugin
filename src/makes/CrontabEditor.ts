import {CrontabExpression} from "./CrontabExpression";


export class CrontabEditor {
    protected _lines: CrontabExpression[];

    public constructor(content: string) {
        this._lines = content.split("\n")
            .filter((line) => !!line.trim())
            .map((line) => CrontabExpression.parse(line));
    }

    public get lines() {
        return this._lines;
    }

    public toString(format: "standard" | "extended" = "standard") {
        return this._lines.map((line) => {
            return line.toString(format);
        }).join("\n") + "\n";
    }
}
