export class CrontabExpression {
    protected _second: string;
    protected _minute: string;
    protected _hour: string;
    protected _dayOfMonth: string;
    protected _month: string;
    protected _dayOfWeek: string;
    protected _alias?: CrontabExpression.Alias;
    public command: string;

    public constructor(params: CrontabExpression.Params) {
        this._second = params.second;
        this._minute = params.minute;
        this._hour = params.hour;
        this._dayOfMonth = params.dayOfMonth;
        this._month = params.month;
        this._dayOfWeek = params.dayOfWeek;

        if(params.alias) {
            this._alias = params.alias;
        }

        this.command = params.command;
    }

    public get alias(): CrontabExpression.Alias | undefined {
        return this._alias;
    }

    public set alias(alias: CrontabExpression.Alias) {
        const params = CrontabExpression.parseExpression(`${CrontabExpression.Aliases[alias]} ${this.command}`, "extended");

        this._alias = alias;
        this._second = params.second;
        this._minute = params.minute;
        this._hour = params.hour;
        this._dayOfMonth = params.dayOfMonth;
        this._month = params.month;
        this._dayOfWeek = params.dayOfWeek;
    }

    public get second() {
        return this._second;
    }

    public set second(second: string) {
        if(this._second === second) {
            return;
        }

        this._second = second;
        this.resetAlias();
    }

    public get minute() {
        return this._minute;
    }

    public set minute(minute: string) {
        if(this._minute === minute) {
            return;
        }

        this._minute = minute;
        this.resetAlias();
    }

    public get hour() {
        return this._hour;
    }

    public set hour(hour: string) {
        if(this._hour === hour) {
            return;
        }

        this._hour = hour;
        this.resetAlias();
    }

    public get dayOfMonth() {
        return this._dayOfMonth;
    }

    public set dayOfMonth(dayOfMonth: string) {
        if(this._dayOfMonth === dayOfMonth) {
            return;
        }

        this._dayOfMonth = dayOfMonth;
        this.resetAlias();
    }

    public get month() {
        return this._month;
    }

    public set month(month: string) {
        if(this._month === month) {
            return;
        }
        this._month = month;
        this.resetAlias();
    }

    public get dayOfWeek() {
        return this._dayOfWeek;
    }

    public set dayOfWeek(dayOfWeek: string) {
        if(this._dayOfWeek === dayOfWeek) {
            return;
        }
        this._dayOfWeek = dayOfWeek;
        this.resetAlias();
    }

    protected resetAlias() {
        if(this._alias) {
            delete this._alias;
        }
    }

    public toString(format?: "standard" | "extended"): string {
        if(this._alias) {
            return `@${this._alias} ${this.command}`;
        }

        const standard = `${this._minute} ${this._hour} ${this._dayOfMonth} ${this._month} ${this._dayOfWeek}`;

        if(format === "extended" || this._second !== "0") {
            return `${this._second} ${standard} ${this.command}`;
        }

        return `${standard} ${this.command}`;
    }

    protected static parseExpression(expression: string, type: CrontabExpression.Type = "standard"): CrontabExpression.Params {
        const trimmed = expression.trim();

        if(trimmed.startsWith("@")) {
            const spaceIndex = trimmed.search(/\s/),
                  aliasStr = spaceIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIndex),
                  command = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1);

            if(!(aliasStr in CrontabExpression.Aliases)) {
                throw new Error(`Unknown alias: @${aliasStr}`);
            }

            const alias = aliasStr as CrontabExpression.Alias;

            return {
                ...this.parseExpression(`${CrontabExpression.Aliases[alias]} ${command}`, "extended"),
                alias
            };
        }

        const tokens: string[] = type === "extended" ? [] : ["0"];

        let command = expression.trim();

        while(tokens.length < 6) {
            const index = command.search(/\s/);

            if(index === -1) {
                throw new Error("Arguments missing");
            }

            tokens.push(command.slice(0, index));

            command = command.slice(index + 1).trim();
        }

        return {
            second: tokens[0],
            minute: tokens[1],
            hour: tokens[2],
            dayOfMonth: tokens[3],
            month: tokens[4],
            dayOfWeek: tokens[5],
            command
        };
    }

    public static parse(expression: string, type: CrontabExpression.Type = "standard"): CrontabExpression {
        return new CrontabExpression(
            this.parseExpression(expression, type)
        );
    }
}

export namespace CrontabExpression {
    export type Type = "standard" | "extended";

    export const Aliases = {
        yearly: "0 0 0 1 1 *",
        annually: "0 0 0 1 1 *",
        monthly: "0 0 0 1 * *",
        weekly: "0 0 0 * * 0",
        daily: "0 0 0 * * *",
        hourly: "0 0 * * * *",
        minutely: "0 * * * * *",
        secondly: "* * * * * *",
        weekdays: "0 0 0 * * 1-5",
        weekends: "0 0 0 * * 0,6"
    };

    export type Alias = keyof typeof Aliases;

    export type Params = {
        second: string;
        minute: string;
        hour: string;
        dayOfMonth: string;
        month: string;
        dayOfWeek: string;
        alias?: Alias;
        command: string;
    };
}
