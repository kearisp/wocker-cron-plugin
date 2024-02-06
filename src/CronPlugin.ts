import {
    Injectable,
    AppConfigService,
    ProjectService,
    DockerService,
    Plugin,
    Logger,
    Cli,
    FSManager,
    Project
} from "@wocker/core";
import * as Path from "path";
import {promises as FS, existsSync} from "fs";


type StartOptions = {
    restart?: boolean;
    build?: boolean;
};

type CrontabOptions = {
    name?: string;
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
            .option("remove", {
                type: "boolean",
                alias: "r",
                description: "Remove current crontab"
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

        const fs = new FSManager(
            Path.join(__dirname, "../plugin"),
            Path.join(__dirname, "../plugin")
        );

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            await this.build(build);

            // const cronPackage = await require("@wocker/area");
            // const areaPackagePath = Path.join(__dirname, "../../../package.json");
            // const cronCliPath = Path.join(__dirname, "../../cron");

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                networkMode: "host",
                volumes: [
                    "/var/run/docker.sock.raw:/var/run/docker.sock",
                    // ...existsSync(areaPackagePath) ? [
                    //     `${Path.join(__dirname, "../../cron")}:/root/app`
                    // ] : []
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
            remove
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(remove) {
            project.unsetMeta("crontab");

            await project.save();

            return;
        }

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
