import {Cli} from "@wocker/core";
import {
    AppConfigService,
    ProjectService,
    DockerService,
    Plugin,
    Injectable,
    FS
} from "@wocker/ws";
import * as Path from "path";
import * as OS from "os";

import {spawn} from "./utils/spawn";


type StartOptions = {
    restart?: boolean;
    build?: boolean;
};

type CrontabOptions = {
    name?: string;
    list?: boolean;
    edit?: boolean;
    remove?: boolean;
};

@Injectable()
export class CronPlugin extends Plugin {
    protected containerName = "cron.ws";
    protected imageName = "wocker-cron";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService
    ) {
        super("cron");
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
            .help({
                description: "Starting cron"
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
            .option("list", {
                type: "boolean",
                alias: "l",
                description: "Show crontab"
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
            .help({
                description: "Crontab"
            })
            .action((options, filename) => this.crontab(options, filename as string));
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

            if(!FS.existsSync(this.dataPath("crontab.json"))) {
                await FS.writeJSON(this.dataPath("crontab.json"), {});
            }

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                networkMode: "host",
                restart: "always",
                volumes: [
                    "/var/run/docker.sock.raw:/var/run/docker.sock",
                    `${this.appConfigService.dataPath("ws.log")}:/root/app/ws.log`,
                    `${this.dataPath("crontab.json")}:/root/app/plugins/cron/crontab.json`
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
    }

    public async stop() {
        console.info("Stopping cron...");

        await this.dockerService.removeContainer(this.containerName);
    }

    public async crontab(options: CrontabOptions, filename?: string) {
        const {
            name,
            list,
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
        else if(remove) {
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

            await this.setCrontab(project.containerName, crontab);
            await this.updateCrontab();
            return;
        }

        if(filename) {
            const file = await FS.readFile(filename);

            await this.setCrontab(project.containerName, file.toString());
            await this.updateCrontab();
            return;
        }

        if(list) {
            return this.getCrontab(project.containerName);
        }
    }

    protected async edit() {
        const project = await this.projectService.get();

        const crontabPath = Path.join(OS.tmpdir(), "ws-crontab.txt");
        const crontab = await this.getCrontab(project.containerName);

        await FS.writeFile(crontabPath, crontab);
        await spawn("nano", [crontabPath]);

        const res = await FS.readFile(crontabPath);
        await FS.rm(crontabPath);

        if(crontab === res.toString()) {
            return;
        }

        await this.setCrontab(project.containerName, res.toString());
        await this.updateCrontab();
    }

    protected async remove() {
        const project = await this.projectService.get();

        project.unsetMeta("crontab");

        await project.save();
    }

    protected async getCrontab(name: string): Promise<string> {
        if(!FS.existsSync(this.dataPath("crontab.json"))) {
            return "";
        }

        const {
            [name]: crontab = ""
        } = await FS.readJSON(this.dataPath("crontab.json"));

        return crontab;
    }

    protected async setCrontab(name: string, crontab: string) {
        if(!FS.existsSync(this.dataPath("crontab.json"))) {
            await FS.writeJSON(this.dataPath("crontab.json"), {
                [name]: crontab
            });
            return;
        }

        await FS.writeJSON(this.dataPath("crontab.json"), {
            ...await FS.readJSON(this.dataPath("crontab.json")),
            [name]: crontab
        });
    }

    protected async updateCrontab() {
        const container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            return;
        }

        const exec = await container.exec({
            Tty: false,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Cmd: ["bash", "-i", "-c", "ws-cron update"]
        });

        const res = await exec.start({
            stdin: true,
            Tty: true,
            hijack: true
        });

        this.dockerService.attachStream(res);
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
