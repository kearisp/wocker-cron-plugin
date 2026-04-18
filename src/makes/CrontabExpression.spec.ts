import {describe, it, expect} from "@jest/globals";
import {CrontabExpression} from "./CrontabExpression";


describe("CrontabExpression", (): void => {
    describe("parse", (): void => {
        it("should parse standard expression (5 fields)", (): void => {
            const cron = CrontabExpression.parse("*/5 * * * * echo hello");

            expect(cron.minute).toBe("*/5");
            expect(cron.hour).toBe("*");
            expect(cron.dayOfMonth).toBe("*");
            expect(cron.month).toBe("*");
            expect(cron.dayOfWeek).toBe("*");
            expect(cron.command).toBe("echo hello");
            expect(cron.alias).toBeUndefined();
        });

        it("should parse extended expression (6 fields)", (): void => {
            const cron = CrontabExpression.parse("0 */5 * * * * echo hello", "extended");

            expect(cron.second).toBe("0");
            expect(cron.minute).toBe("*/5");
            expect(cron.command).toBe("echo hello");
        });

        it("should parse alias expression", (): void => {
            const cron = CrontabExpression.parse("@daily echo hello");

            expect(cron.alias).toBe("daily");
            expect(cron.command).toBe("echo hello");
            expect(cron.toString()).toBe("@daily echo hello");
        });

        it("should throw error for invalid cron string", (): void => {
            expect(() => CrontabExpression.parse("* * * echo hello")).toThrow();
        });

        it("should preserve spaces in command", (): void => {
            const cron = CrontabExpression.parse("* * * * *  echo   hello ");

            expect(cron.command).toBe("echo   hello");
        });
    });

    describe("toString", (): void => {
        it("should return alias if set", (): void => {
            const cron = CrontabExpression.parse("@hourly some command");

            expect(cron.toString()).toBe("@hourly some command");
        });

        it("should return standard format by default", (): void => {
            const cron = CrontabExpression.parse("1 2 3 4 5 cmd");

            expect(cron.toString()).toBe("1 2 3 4 5 cmd");
        });

        it("should return extended format when requested", (): void => {
            const cron = CrontabExpression.parse("1 2 3 4 5 cmd");

            expect(cron.toString("extended")).toBe("0 1 2 3 4 5 cmd");
        });
    });

    describe("setters and alias reset", (): void => {
        it("should reset alias when field changes", (): void => {
            const cron = CrontabExpression.parse("@daily cmd");

            cron.minute = "1";

            expect(cron.alias).toBeUndefined();
            expect(cron.toString()).toBe("1 0 * * * cmd");
        });

        it("should reset alias when hour changes", (): void => {
            const cron = CrontabExpression.parse("@daily cmd");

            cron.hour = "1";

            expect(cron.alias).toBeUndefined();
        });

        it("should reset fields when alias changes", () => {
            const cron = CrontabExpression.parse("* * * * * ls");

            cron.alias = "hourly";

            expect(cron.toString()).toBe(`@hourly ls`);
        });
    });
});
