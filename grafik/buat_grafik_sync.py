#!/usr/bin/env python3
"""
Fig. 3 (per-batch records + sync latency) and Fig. 4 (edge resource use)
generated from syn_logs.csv.

Changes vs. the previous script
  * No hard-coded "DLR = 0%" label. Any number drawn on a figure is computed
    from the CSV (or passed explicitly with --n-edge / --n-cloud).
  * Sessions are detected automatically (gap > --gap-min minutes) and plotted
    separately instead of mixing runs through df.tail(100).
  * Stacked bars include `duplicates`, so accepted + rejected + duplicates = sent.
  * Axis/legend naming: sync_duration_ms is *cloud-side processing time per batch*,
    not end-to-end latency.
  * "failed" rows are labelled "rejected by cloud" (the log has no network-timeout rows).
  * Cycles that follow an unusually long gap are marked as possible missed cycles.
  * CPU is drawn only if it is not identically zero; memory is labelled as such.
  * Font fallback (Times New Roman -> Liberation Serif -> DejaVu Serif).
  * Writes summary_by_session.csv (mean +/- SD etc.) for the paper's tables.

Usage
  python plot_sync_figures.py --csv syn_logs.csv --outdir figs            # latest session only (default)
  python plot_sync_figures.py --csv syn_logs.csv --session all             # every session, one figure each
  python plot_sync_figures.py --csv syn_logs.csv --annotate --n-edge 15002 --n-cloud 15002
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

# ------------------------------------------------------------------ style
def set_font():
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in ("Times New Roman", "Liberation Serif", "DejaVu Serif"):
        if name in available:
            plt.rcParams["font.family"] = name
            return name
    return plt.rcParams["font.family"]


C_ACC, C_REJ, C_DUP = "royalblue", "crimson", "gray"
C_LAT, C_MEM, C_CPU = "darkorange", "teal", "darkmagenta"


# ------------------------------------------------------------------ data
REQUIRED = ["created_at", "sync_duration_ms", "memory_usage_mb", "cpu_usage_pct",
            "throughput_rps", "records_sent", "records_accepted",
            "records_failed", "duplicates"]


def load(csv_path, gap_min):
    if not os.path.exists(csv_path):
        sys.exit(f"File not found: {csv_path}")
    df = pd.read_csv(csv_path)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        sys.exit(f"Missing columns: {missing}")
    df["t"] = pd.to_datetime(df["created_at"], utc=True)
    df = df.sort_values("t").reset_index(drop=True)
    gap = df["t"].diff().dt.total_seconds()
    df["gap_s"] = gap
    df["session"] = (gap > gap_min * 60).fillna(False).cumsum() + 1
    df.loc[df["session"] != df["session"].shift(), "gap_s"] = np.nan  # no predecessor in this session
    # sanity check: every sent row must be accounted for
    chk = df["records_accepted"] + df["records_failed"] + df["duplicates"] - df["records_sent"]
    if (chk != 0).any():
        print(f"[warn] {(chk != 0).sum()} rows where accepted+failed+duplicates != sent")
    return df


def summarize(g):
    sent = g["records_sent"].sum()
    s = {
        "cycles": len(g),
        "start_utc": g["t"].min().strftime("%Y-%m-%d %H:%M:%S"),
        "duration_h": round((g["t"].max() - g["t"].min()).total_seconds() / 3600, 2),
        "median_interval_s": round(g["gap_s"].median(), 1),
        "records_sent": int(sent),
        "accepted": int(g["records_accepted"].sum()),
        "rejected_by_cloud": int(g["records_failed"].sum()),
        "duplicates_ignored": int(g["duplicates"].sum()),
        "rejected_pct": round(100 * g["records_failed"].sum() / sent, 2),
        "cloud_time_ms_mean": round(g["sync_duration_ms"].mean(), 1),
        "cloud_time_ms_sd": round(g["sync_duration_ms"].std(), 1),
        "cloud_time_ms_median": g["sync_duration_ms"].median(),
        "cloud_time_ms_p95": round(g["sync_duration_ms"].quantile(0.95), 1),
        "throughput_rps_mean": round(g["throughput_rps"].mean(), 0),
        "throughput_rps_max": round(g["throughput_rps"].max(), 0),
        "mem_mb_mean": round(g["memory_usage_mb"].mean(), 2),
        "mem_mb_max": round(g["memory_usage_mb"].max(), 2),
        "cpu_pct_max": g["cpu_usage_pct"].max(),
    }
    return s


# ------------------------------------------------------------------ figures
def fig_records_latency(g, sid, outdir, annotate, n_edge, n_cloud, dpi):
    x = np.arange(len(g))
    lw = 0.3 if len(g) <= 120 else 0.0   # thin edges look muddy with hundreds of bars
    fig, ax1 = plt.subplots(figsize=(7, 3.8))
    ax1.bar(x, g["records_accepted"], color=C_ACC, edgecolor="black", linewidth=lw,
            label="Accepted", alpha=0.85)
    ax1.bar(x, g["records_failed"], bottom=g["records_accepted"], color=C_REJ,
            edgecolor="black", linewidth=lw, label="Rejected by cloud", alpha=0.85)
    ax1.bar(x, g["duplicates"], bottom=g["records_accepted"] + g["records_failed"],
            color=C_DUP, edgecolor="black", linewidth=max(lw, 0.6), hatch="//",
            label="Duplicates ignored", alpha=0.85)
    ax1.set_xlabel("Synchronization cycle (batch index)", fontweight="bold")
    ax1.set_ylabel("Records per batch", fontweight="bold")
    ax1.set_ylim(0, g["records_sent"].max() * 1.08)
    ax1.grid(True, linestyle=":", alpha=0.6, color="gray")

    ax2 = ax1.twinx()
    ax2.plot(x, g["sync_duration_ms"], color=C_LAT, marker="^", markersize=3,
             linewidth=1.2, label="Cloud processing time (ms)")
    ax2.set_ylabel("Cloud processing time (ms)", fontweight="bold")
    ax2.set_ylim(0, g["sync_duration_ms"].max() * 1.15)

    # possible missed cycles: gap clearly longer than the normal interval
    thr = 2 * g["gap_s"].median()
    gaps = x[(g["gap_s"] > thr).fillna(False).to_numpy()]
    if len(gaps):
        ax1.plot(gaps, np.zeros(len(gaps)) + 2, linestyle="none", marker="v",
                 color="black", markersize=6, label=f"Gap > {thr:.0f} s (missed cycle)")

    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1 + h2, l1 + l2, loc="upper center", bbox_to_anchor=(0.5, -0.17),
               ncol=3, fontsize=7.5, framealpha=1.0, edgecolor="black")

    if annotate:
        sent = g["records_sent"].sum()
        lines = [f"Accepted: {100*g['records_accepted'].sum()/sent:.1f}%  "
                 f"Rejected: {100*g['records_failed'].sum()/sent:.1f}%  "
                 f"Duplicates ignored: {int(g['duplicates'].sum())} rows"]
        if n_edge is not None and n_cloud is not None:
            dlr = 100 * (n_edge - n_cloud) / n_edge
            lines.append(f"DLR = {dlr:.2f}% (N_edge={n_edge}, N_cloud={n_cloud})")
        ax1.text(0.5, 1.02, "\n".join(lines), transform=ax1.transAxes, ha="center",
                 va="bottom", fontsize=8)
    fig.tight_layout()
    path = os.path.join(outdir, f"Fig3_records_latency_S{sid}.png")
    fig.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close(fig)
    return path


def fig_resources(g, sid, outdir, dpi):
    x = np.arange(len(g))
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.plot(x, g["memory_usage_mb"], color=C_MEM, marker="s", markersize=3,
            linewidth=1.2, label="Sync-process memory (MB)")
    ax.axhline(g["memory_usage_mb"].mean(), color=C_MEM, linestyle=":", linewidth=1,
               label=f"Mean = {g['memory_usage_mb'].mean():.2f} MB")
    ax.set_xlabel("Synchronization cycle (batch index)", fontweight="bold")
    ax.set_ylabel("Memory (MB)", fontweight="bold")
    ax.set_ylim(0, g["memory_usage_mb"].max() * 1.3)
    ax.grid(True, linestyle=":", alpha=0.6, color="gray")
    handles, labels = ax.get_legend_handles_labels()

    if g["cpu_usage_pct"].max() > 0:
        ax2 = ax.twinx()
        ax2.plot(x, g["cpu_usage_pct"], color=C_CPU, marker="o", markersize=3,
                 linestyle="--", linewidth=1.2, label="CPU (%)")
        ax2.set_ylabel("CPU (%)", fontweight="bold")
        ax2.set_ylim(0, max(g["cpu_usage_pct"].max() * 1.3, 5))
        h2, l2 = ax2.get_legend_handles_labels()
        handles += h2
        labels += l2
    else:
        print(f"[warn] S{sid}: cpu_usage_pct is 0 in every row -> CPU line omitted. "
              "Log CPU with a finer resolution (e.g. psutil.Process().cpu_percent) "
              "or report CPU from an external monitor (top/pidstat).")
    ax.legend(handles, labels, loc="upper right", fontsize=7.5, framealpha=1.0,
              edgecolor="black")
    fig.tight_layout()
    path = os.path.join(outdir, f"Fig4_resources_S{sid}.png")
    fig.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close(fig)
    return path


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "syn_logs.csv"))
    ap.add_argument("--outdir", default="figs")
    ap.add_argument("--gap-min", type=float, default=60, help="gap (minutes) that starts a new session")
    ap.add_argument("--session", default="latest",
                    help="'latest' (default), 'all', or a 1-based session id")
    ap.add_argument("--annotate", action="store_true", help="draw computed totals on Fig. 3")
    ap.add_argument("--n-edge", type=int, default=None, help="rows generated at the edge (for DLR)")
    ap.add_argument("--n-cloud", type=int, default=None, help="unique rows found in PostgreSQL (for DLR)")
    ap.add_argument("--dpi", type=int, default=300)
    a = ap.parse_args()

    font = set_font()
    plt.rcParams["font.size"] = 9
    os.makedirs(a.outdir, exist_ok=True)
    df = load(a.csv, a.gap_min)
    print(f"Read {len(df)} rows from {os.path.basename(a.csv)}; font = {font}")

    last = int(df["session"].max())
    if a.session == "latest":
        wanted = {last}
    elif a.session == "all":
        wanted = set(df["session"].unique())
    else:
        wanted = {int(a.session)}
    print(f"Sessions in file: {last}; plotting: {sorted(wanted)}")

    rows = []
    for sid, g in df.groupby("session"):
        if sid not in wanted:
            continue
        g = g.reset_index(drop=True)
        s = summarize(g)
        s["session"] = sid
        rows.append(s)
        p3 = fig_records_latency(g, sid, a.outdir, a.annotate, a.n_edge, a.n_cloud, a.dpi)
        p4 = fig_resources(g, sid, a.outdir, a.dpi)
        print(f"S{sid}: {len(g)} cycles -> {p3}, {p4}")

    summ = pd.DataFrame(rows).set_index("session")
    out_csv = os.path.join(a.outdir, "summary_by_session.csv")
    summ.to_csv(out_csv)
    print("\nSummary (copy these numbers into the paper tables):")
    print(summ.T.to_string())
    print(f"\nSaved {out_csv}")


if __name__ == "__main__":
    main()