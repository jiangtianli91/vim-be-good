import * as fs from "fs";
import { Neovim, Buffer, Window } from "neovim";
import { GameBuffer } from "../game-buffer";
import { Round } from "./round";
import { GameState, GameOptions, GameDifficulty, IGame } from "./types";

// this is a comment
export function newGameState(buffer: Buffer, window: Window): GameState {
    return {
        buffer,
        name: "",
        failureCount: 0,
        window,
        ending: { count: 10 },
        currentCount: 1,
        lineRange: { start: 2, end: 22 },
        lineLength: 20,
        results: [],
    };
}

export const extraWords = [
    "aar",
    "bar",
    "car",
    "dar",
    "ear",
    "far",
    "gar",
    "har",
    "iar",
    "jar",
    "kar",
    "lar",
    "mar",
    "nar",
    "oar",
    "par",
    "qar",
    "rar",
    "sar",
    "tar",
    "uar",
    "var",
    "war",
    "xar",
    "yar",
    "zar",
];

export const extraSentences = [
    "def _grad_input_padding(grad_output, input_size, stride,  dilation=None):",
    "min_sizes = [dim_size(d) for d in range(k)]",
    "One is the best Prime Number",
    "Brandon is the best One",
    "Time and reason must cooperate with each other to the final establishment of any principle;",
    "[MAN] A man ordered 2,000 drums of pink ping pong balls in Paris, France",
    "I Twitch when I think about the Discord",
    "In particular, PEOPLE who are used to SVN or P4 who want to throw away uncommitted changes",
    "He paid $120 (80 Euros!) per drum, which means he spent $240,000 on 200,000 pink ping pong balls",
    "to a file will often reach for revert before being told that they actually want reset.",
    "My dog is ALSO my dawg",
    "/a/&B#R{+1}>>[Bb] = X0 - 3 + @a rooftop ^ 32 + 12443678923458789 && 1 2 3 < 4.",
    "b){BALL} These pink ping pong balls measured 40mm (how many inches?) and",
    "def __init__(self, d_model: int = 512, nhead: int = 8, num_encoder_layers: int = 6",
    "num_decoder_layers: int = 6, dim_feedforward: int = 2048, dropout: float = 0.1,",
    "activation: str = 'relu', custom_encoder: Optional[Any] = None,",
    "custom_decoder: Optional[Any] = None) -> None:",
    "super(Transformer, self).__init__()",
    "The internet is AN AMAZING PLACE FULL OF INTERESTING facts",
    "Did you know the INTERNET crosses continental boundaries using a wire?!",
    "I am out of interesting facts to type here",
    "Others should contribute more SENTENCES to be used in the game",
];

export function getRandomWord(): string {
    return extraWords[Math.floor(Math.random() * extraWords.length)];
}

export function getRandomSentence(): string {
    return extraSentences[Math.floor(Math.random() * extraSentences.length)];
}

export class Game implements IGame {
    private timerId?: ReturnType<typeof setTimeout>;
    private onExpired: (() => void)[];
    private timerExpired: boolean;
    public currentRound!: Round;
    public difficulty!: GameDifficulty;

    constructor(
        public nvim: Neovim,
        public gameBuffer: GameBuffer,
        public state: GameState,
        public rounds: Round[],
        opts: GameOptions = {
            difficulty: GameDifficulty.Easy,
        },
    ) {
        this.onExpired = [];
        this.timerExpired = false;
        this.difficulty = opts.difficulty;
    }

    public async startRound(): Promise<void> {
        console.log("Game#startRound");

        const nextRound = this.rounds[
            Math.floor(Math.random() * this.rounds.length)
        ];

        if (this.currentRound === nextRound) {
            console.log("Game#startRound currentRound === nextRound");
            return;
        }

        const instructions = nextRound.getInstructions();

        await this.gameBuffer.clearBoard();
        this.gameBuffer.setInstructions(instructions);

        this.currentRound = nextRound;
    }

    public async checkForWin(): Promise<boolean> {
        return await this.currentRound.isRoundComplete(this);
    }

    public async hasFailed(): Promise<boolean> {
        console.log(`Game#hasFailed -> ${this.timerExpired}`);
        return this.timerExpired;
    }

    public async run(firstRun: boolean): Promise<void> {
        console.log(`Game#run(${firstRun})`);

        const lines = await this.currentRound.render(this);
        await this.gameBuffer.render(lines);

        // Post render for positional adjustments to game.
        await this.currentRound.postRender(this);

        if (this.currentRound.isTimedRound(this.difficulty)) {
            console.log("Game -- run -- starting timer");
            this.startTimer();
        }
    }

    // Anything left to do here?
    public async endRound(): Promise<void> {
        this.clearTimer();
    }

    public async finish(): Promise<void> {
        const fName = `/tmp/${this.state.name}-${Date.now()}.csv`;
        const results = this.state.results.map((x) => x + "").join(",\n");

        console.log("base -- finish", fName, results);

        fs.writeFileSync(fName, results);

        await this.gameBuffer.finish();
    }

    private startTimer(): void {
        const time = this.currentRound.getTimeoutTime(this.difficulty);

        console.log("base - startTimer", time);

        this.timerExpired = false;

        this.timerId = setTimeout(() => {
            this.timerExpired = true;
            this.onExpired.forEach((cb) => cb());

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore I HATE YOU TYPESCRIPT
            this.timerId = 0;
        }, time);
    }

    private clearTimer(): void {
        console.log("base - clearTimer", this.timerId);

        if (this.timerId) {
            clearTimeout(this.timerId);
        }
    }

    public onTimerExpired(cb: () => void): void {
        console.log("On timer expired");
        this.onExpired.push(cb);
    }

    public nextRoundNumber() {
        if (this.difficulty === GameDifficulty.Noob) {
            console.log(
                "base - decrementRoundNumber#noob - ",
                this.state.currentCount,
            );
            return this.state.currentCount - 1;
        } else {
            console.log(
                "base - incrementRoundNumber - ",
                this.state.currentCount,
            );
            return this.state.currentCount + 1;
        }
    }
}
