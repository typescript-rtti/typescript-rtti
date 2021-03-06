import "reflect-metadata";
import "source-map-support/register";
import { suite } from "razmin";

suite().include(['./**/*.test.js']).run();