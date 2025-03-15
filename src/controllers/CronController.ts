import {
    Controller,
    Command,
    Option,
    Param,
    AppConfigService,
    DockerService,
    ProjectService,
    FileSystem
} from "@wocker/core";

import {CronService} from "../services/CronService";


@Controller()
export class CronController {
    protected containerName = "cron.ws";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly cronService: CronService,
        protected readonly dockerService: DockerService,
        protected readonly projectService: ProjectService
    ) {}

    @Command("cron:start")
    async start(
        @Option("build", {
            type: "boolean",
            alias: "b",
            description: "Build image"
        })
        build?: boolean,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart service"
        })
        restart?: boolean
    ): Promise<void> {
        console.info("Starting cron...");

        await this.cronService.start(restart, build);
    }

    @Command("cron:stop")
    async stop(): Promise<void> {
        console.info("Stopping cron...");

        await this.cronService.stop();
    }

    @Command("cron:logs")
    public async logs(): Promise<void> {
        await this.cronService.logs();
    }

    @Command("crontab [filename]")
    async crontab(
        @Param("filename")
        filename?: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name?: string,
        @Option("list", {
            type: "boolean",
            alias: "l",
            description: "Show crontab"
        })
        list?: boolean,
        @Option("edit", {
            type: "boolean",
            alias: "e",
            description: "Edit current crontab"
        })
        edit?: boolean,
        @Option("remove", {
            type: "boolean",
            alias: "r",
            description: "Remove current crontab"
        })
        remove?: boolean
    ): Promise<string | undefined> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(edit) {
            await this.cronService.edit(project.containerName);
        }
        else if(list) {
            return this.cronService.getCrontab(project.containerName);
        }
        else if(filename) {
            const fs = new FileSystem(this.appConfigService.pwd())

            const file = fs.readFile(filename);

            await this.cronService.setCrontab(project.containerName, file.toString());
        }
        else if(remove) {
            await this.cronService.setCrontab(project.containerName, "");
        }
        else if(!filename && !process.stdin.isTTY) {
            const crontab: string = await new Promise((resolve, reject) => {
                let res = "";

                process.stdin.on("data", (data) => {
                    res += data.toString();
                });

                process.stdin.on("end", () => {
                    resolve(res);
                });

                process.stdin.on("error", reject);
            });

            await this.cronService.setCrontab(project.containerName, crontab);
        }

        await this.dockerService.exec(this.containerName, [
            "bash", "-c", [
                "docker-gen -notify \"crontab /root/app/crontab.txt\" /root/app/crontab.tmpl /root/app/crontab.txt"
            ].join(" ")
        ]);
    }
}
