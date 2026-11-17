// Shape of a compiled film (written by scene/compile.py, read by Film.tsx).
import type { V3 } from "../inkbeat/types";
export type LookData = { height?: number; skin: string; outfit: string; top: string; bottom: string; hair: string; hairColor: string; hat?: string; glasses?: string; mustache?: string; nose?: string };
export type CharData = { id: string; p: number[]; yaw: number; legs: string | null; action: string; face: string; holds: string[] };
export type Subject = { char?: string; held?: string; token?: string; point?: number[]; size?: number };
export type ShotData = { id: string; t0: number; t1: number; type: string; move: string; subject: Subject; second: string | null; chars: CharData[]; labels: string[]; shows?: string[]; focus?: number[]; cam: { keys: { from: number[]; look: number[] }[]; fov: number } };
export type PieceData = { kind: string; p: number[]; yaw: number; s: number; opts: Record<string, unknown>; name: string; loose?: boolean };
export type SceneData = { id: string; t0: number; t1: number; tag: string; kit: string; options: Record<string, unknown>; mood: string; sky: boolean; night: boolean; pieces: PieceData[];
  planes: { p: number[]; yaw?: number; gear?: boolean; stairs?: boolean; focus?: number[]; stairs_from?: number; stairs_shot?: string }[]; rain: boolean; crowd: { look: number; p: number[]; vel: number[]; yaw: number; walk: boolean }[];
  limit: { x: number; zmax: number; ymax: number } | null; azimuth?: number; shots: ShotData[] };
export type FilmData = { name: string; title: string; fps: number; frames: number; voice: string; music: string; words: (string | number)[][]; cast: Record<string, LookData>; scenes: SceneData[] };
export const v3 = (a: number[]): V3 => [a[0], a[1], a[2]];
