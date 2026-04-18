import {describe, it, expect} from "@jest/globals";
import {CrontabEditor} from "./CrontabEditor";
import {CrontabExpression} from "./CrontabExpression";


describe("CrontabEditor", (): void => {
    describe("constructor", (): void => {
        it("should parse each non-empty line into a CrontabExpression", (): void => {
            const editor = new CrontabEditor(
                "* * * * * echo one\n"
                + "1 2 3 4 5 echo two"
            );

            expect(editor.lines).toHaveLength(2);
            expect(editor.lines[0]).toBeInstanceOf(CrontabExpression);
            expect(editor.lines[0].command).toBe("echo one");
            expect(editor.lines[1].command).toBe("echo two");
        });

        it("should filter out blank lines", (): void => {
            const editor = new CrontabEditor(
                "\n"
                + "* * * * * echo one\n"
                + "\n"
                + "   \n"
                + "1 2 3 4 5 echo two\n"
            );

            expect(editor.lines).toHaveLength(2);
        });

        it("should result in an empty editor for empty content", (): void => {
            const editor = new CrontabEditor("");

            expect(editor.lines).toHaveLength(0);
        });

        it("should throw for a line with an invalid expression", (): void => {
            expect(() => new CrontabEditor("* * * echo hello")).toThrow();
        });

        it("should parse alias lines", (): void => {
            const editor = new CrontabEditor("@daily echo hello");

            expect(editor.lines[0].alias).toBe("daily");
            expect(editor.lines[0].command).toBe("echo hello");
        });
    });

    describe("toString", (): void => {
        it("should join lines with a newline and end with a trailing newline", (): void => {
            const editor = new CrontabEditor(
                "* * * * * echo one\n"
                + "1 2 3 4 5 echo two"
            );

            expect(editor.toString()).toBe(
                "* * * * * echo one\n"
                + "1 2 3 4 5 echo two\n"
            );
        });

        it("should render an empty crontab as just a trailing newline", (): void => {
            const editor = new CrontabEditor("");

            expect(editor.toString()).toBe("\n");
        });

        it("should default to standard format", (): void => {
            const editor = new CrontabEditor("1 2 3 4 5 echo hello");

            expect(editor.toString()).toBe("1 2 3 4 5 echo hello\n");
        });

        it("should render every line in extended format when requested", (): void => {
            const editor = new CrontabEditor(
                "* * * * * echo one\n"
                + "1 2 3 4 5 echo two"
            );

            expect(editor.toString("extended")).toBe(
                "0 * * * * * echo one\n"
                + "0 1 2 3 4 5 echo two\n"
            );
        });

        it("should reflect mutations made through the parsed lines", (): void => {
            const editor = new CrontabEditor("* * * * * echo hello");

            editor.lines[0].minute = "*/5";

            expect(editor.toString()).toBe("*/5 * * * * echo hello\n");
        });
    });
});
