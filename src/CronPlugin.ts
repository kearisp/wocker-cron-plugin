import {
    Injectable,
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService,
    Plugin,
    Logger,
    Cli,
    FSManager,
    Project
} from "@wocker/core";
import * as Path from "path";
import * as OS from "os";
import {promises as FS, existsSync} from "fs";

import {exec} from "./utils/exec";
import {spawn} from "./utils/spawn";


type StartOptions = {
    restart?: boolean;
    build?: boolean;
};

type CrontabOptions = {
    name?: string;
    edit?: boolean;
    remove?: boolean;
};

@Injectable()
export class CronPlugin extends Plugin {
    protected containerName = "cron.ws";
    protected imageName = "wocker-cron";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService
    ) {
        super();
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("cron:start")
            .option("restart", {
                type: "boolean",
                alias: "r",
                description: "Restart service"
            })
            .option("build", {
                type: "boolean",
                alias: "b",
                description: "Rebuild image"
            })
            .action((options) => this.start(options));

        cli.command("cron:stop")
            .action(() => this.stop());

        cli.command("crontab [filename]")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .option("edit", {
                type: "boolean",
                alias: "e",
                description: "Edit current crontab"
            })
            .option("remove", {
                type: "boolean",
                alias: "r",
                description: "Remove current crontab"
            })
            .action((options, filename) => this.crontab(options, filename as string));

        this.appEventsService.on("project:start", (project) => this.updateCrontab(project));
    }

    public async start(options: StartOptions) {
        const {
            restart,
            build
        } = options;

        console.info("Starting cron service...");

        if(restart || build) {
            await this.dockerService.removeContainer(this.containerName);
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            await this.build(build);

            const cronPath = Path.join(__dirname, "../../cron");
            const cronPackagePath = Path.join(cronPath, "package.json");

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                networkMode: "host",
                volumes: [
                    `${Path.join(__dirname, "../plugin/bin/entrypoint.sh")}:/entrypoint.sh`,
                    "/var/run/docker.sock.raw:/var/run/docker.sock",
                    ...existsSync(cronPackagePath) ? [
                        // `${Path.join(cronPath, "lib")}:/root/.nvm/versions/node/v18.16.0/lib/node_modules/@wocker/cron/lib`
                        `${Path.join(cronPath, "lib")}:/usr/lib/node_modules/@wocker/cron/lib`
                    ] : []
                ]
            });
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(["created", "exited"].includes(Status)) {
            await container.start();
        }

        const projects = await this.projectService.search({});

        for(const project of projects) {
            if(project.hasMeta("crontab")) {
                await this.updateCrontab(project);
            }
        }
    }

    public async stop() {
        console.info("Stopping cron...");

        await this.dockerService.removeContainer(this.containerName);
    }

    public async crontab(options: CrontabOptions, filename?: string) {
        const {
            name,
            edit,
            remove
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        if(edit) {
            await this.edit();
            return;
        }

        if(remove) {
            await this.remove();

            return;
        }

        const project = await this.projectService.get();

        if(!process.stdin.isTTY) {
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

            project.setMeta("crontab", crontab);

            await project.save();

            await this.updateCrontab(project);
        }

        if(filename) {
            const file = await FS.readFile(filename);

            project.setMeta("crontab", file.toString());

            await project.save();

            await this.updateCrontab(project);
        }
    }

    protected async edit() {
        const project = await this.projectService.get();

        const crontabPath = Path.join(OS.tmpdir(), "ws-crontab.txt");

        await FS.writeFile(crontabPath, project.getMeta("crontab", ""));
        await spawn("nano", [crontabPath]);

        const res = await FS.readFile(crontabPath);
        await FS.rm(crontabPath);

        if(project.getMeta("crontab", "") === res.toString()) {
            return;
        }

        project.setMeta("crontab", res.toString());

        await project.save();

        await this.updateCrontab(project);
    }

    protected async remove() {
        const project = await this.projectService.get();

        project.unsetMeta("crontab");

        await project.save();
    }

    protected async updateCrontab(project: Project) {
        const container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            return;
        }

        function escapeSpecialChars(str: string) {
            const specialChars = ["$", "\"", "`", "!", "\\"];
            return str.split("")
                .map(c => specialChars.includes(c) ? `\\${c}` : c)
                .join("");
        }

        const exec = await container.exec({
            Tty: false,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Cmd: ["bash", "-i", "-c", `ws-cron set "${project.containerName}" "${escapeSpecialChars(project.getMeta("crontab", ""))}"`]
        });

        const res = await exec.start({
            stdin: true,
            Tty: true,
            hijack: true
        });

        this.dockerService.attachStream(res);

        // const projectContainer = await this.projectService.getContainer();
        //
        // if(!projectContainer) {
        //     return;
        // }
        //
        // console.log(projectContainer);
    }

    protected async build(rebuild?: boolean) {
        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(__dirname, "../plugin"),
            src: "./Dockerfile"
        });
    }
}
