import {Logger} from "@wocker/core";
import {exec as processExec} from "child_process";
import chalk from "chalk";


export const exec = async (command: string) => {
    const worker = processExec(command, {
        maxBuffer: Infinity
    });

    return new Promise((resolve, reject) => {
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        if(process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        if(worker.stdin) {
            process.stdin.pipe(worker.stdin);
        }

        if(worker.stdout) {
            worker.stdout.pipe(process.stdout);
        }

        if(worker.stderr) {
            worker.stderr.pipe(process.stderr);
        }

        worker.on("close", (code: string) => {
            Logger.info("close", chalk.red(code));

            process.stdin.pause();

            if(process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }

            if(worker.stdin) {
                process.stdin.unpipe(worker.stdin);
            }
        });

        worker.on("exit", (code) => {
            if(code !== 0) {
                reject(new Error(`Process exited with code ${code}`));

                return;
            }

            resolve(code);
        });

        worker.on("error", (err) => {
            Logger.info(chalk.red(err.message), {
                command
            });

            reject(err);
        });
    });
};
