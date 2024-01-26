import {
    Injectable,
    AppConfigService,
    ProjectService,
    DockerService,
    Plugin,
    Logger,
    Cli,
    FSManager
} from "@wocker/core";
import Path from "path";
import {promises as FS} from "fs";


type StartOptions = {
    rebuild?: boolean;
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
            .option("rebuild", {
                type: "boolean",
                alias: "r",
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
                description: "Remove the current crontab"
            })
            .action((options, filename) => this.crontab(options, filename as string));
    }

    public async start(options: StartOptions) {
        const {
            rebuild
        } = options;

        if(rebuild) {
            await this.dockerService.removeContainer(this.containerName);
        }

        const fs = new FSManager(
            Path.join(__dirname, "../plugin"),
            Path.join(__dirname, "../plugin")
        );

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            await this.build(rebuild);

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                volumes: [
                    "/var/run/docker.sock:/var/run/docker.sock:ro",
                    `${fs.path()}:/root/app`
                ]
            });
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        Logger.info(Status);

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
        }

        if(filename) {
            const file = await FS.readFile(filename);

            project.setMeta("crontab", file.toString());

            await project.save();
        }

        // project.getMeta("crontab");
        // project.setM
        // const crontab = await this.appConfigService.getMeta("crontab");

        // console.log(">_<", project);
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
