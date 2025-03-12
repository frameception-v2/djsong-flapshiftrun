"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, {
  type Context,
} from "@farcaster/frame-sdk";
import { PROJECT_TITLE } from "~/lib/constants";
import { useGameState } from "~/hooks/useGameState";
import { useCanvas } from "~/hooks/useCanvas";
import { useGameLoop } from "~/hooks/useGameLoop";

// Background scroll configuration
const BACKGROUND_SCROLL_SPEED = 50; // pixels per second
const GROUND_HEIGHT = 50; // pixels

// Helicopter physics parameters
const GRAVITY = 600; // pixels per second squared
const THRUST = -400; // negative because y-axis is inverted in canvas
const MAX_VELOCITY = 400; // maximum vertical velocity
const ROTATION_FACTOR = 0.15; // how much the helicopter rotates based on velocity

// Helicopter dimensions
const HELICOPTER_WIDTH = 60;
const HELICOPTER_HEIGHT = 30;

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext | undefined>();
  const [added, setAdded] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Background scroll position
  const [bgScrollX, setBgScrollX] = useState(0);
  
  // Helicopter physics state
  const [heliPosition, setHeliPosition] = useState({ x: 0, y: 0 });
  const [heliVelocity, setHeliVelocity] = useState(0);
  const [isThrusting, setIsThrusting] = useState(false);
  
  // Use our custom game state hook
  const { 
    status, 
    score, 
    bestScore, 
    lastScore, 
    hasPlayedBefore, 
    startGame, 
    endGame, 
    restartGame, 
    incrementScore 
  } = useGameState();
  
  // Use our canvas hook to get the canvas and context
  const { canvas, context, width, height } = useCanvas(gameContainerRef);

  // Reset helicopter position when game starts
  useEffect(() => {
    if (status === 'PLAYING' && width && height) {
      setHeliPosition({
        x: width / 4,
        y: height / 2
      });
      setHeliVelocity(0);
    }
  }, [status, width, height]);

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      console.error("Error adding frame:", error);
    }
  }, []);

  // Draw the scrolling background
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, scrollX: number) => {
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h - GROUND_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB'); // Sky blue at top
    skyGradient.addColorStop(1, '#E0F7FF'); // Lighter blue at horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h - GROUND_HEIGHT);
    
    // Clouds (simple version)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    // Draw a few clouds at different positions
    const cloudPositions = [
      { x: (100 - scrollX * 0.2) % w, y: 50, width: 80, height: 40 },
      { x: (300 - scrollX * 0.2) % w, y: 80, width: 120, height: 50 },
      { x: (600 - scrollX * 0.2) % w, y: 40, width: 100, height: 45 },
      { x: (900 - scrollX * 0.2) % w, y: 70, width: 90, height: 35 },
    ];
    
    // Wrap clouds around the screen
    cloudPositions.forEach(cloud => {
      if (cloud.x < -cloud.width) {
        cloud.x += w + cloud.width;
      }
      
      // Draw a simple cloud shape
      ctx.beginPath();
      ctx.arc(cloud.x + cloud.width * 0.3, cloud.y + cloud.height * 0.5, cloud.height * 0.5, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.7, cloud.y + cloud.height * 0.5, cloud.height * 0.6, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.5, cloud.y + cloud.height * 0.3, cloud.height * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Ground
    const groundGradient = ctx.createLinearGradient(0, h - GROUND_HEIGHT, 0, h);
    groundGradient.addColorStop(0, '#8B4513'); // Brown at top
    groundGradient.addColorStop(1, '#654321'); // Darker brown at bottom
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h - GROUND_HEIGHT, w, GROUND_HEIGHT);
    
    // Ground details (simple stripes)
    ctx.fillStyle = '#5D4037';
    
    // Draw ground stripes that scroll with the background
    const stripeWidth = 30;
    const stripeSpacing = 50;
    const numStripes = Math.ceil(w / stripeSpacing) + 1;
    
    for (let i = 0; i < numStripes; i++) {
      const stripeX = (i * stripeSpacing - scrollX) % w;
      if (stripeX < -stripeWidth) continue;
      ctx.fillRect(stripeX, h - GROUND_HEIGHT + 10, stripeWidth, 5);
    }
  }, []);

  // Draw the helicopter
  const drawHelicopter = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, velocity: number) => {
    // Calculate rotation based on velocity
    const rotation = velocity * ROTATION_FACTOR;
    
    // Save the current context state
    ctx.save();
    
    // Translate to the helicopter's position
    ctx.translate(x, y);
    
    // Rotate based on velocity
    ctx.rotate(rotation * Math.PI / 180);
    
    // Draw helicopter body
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.fillRect(-HELICOPTER_WIDTH / 2, -HELICOPTER_HEIGHT / 2, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    
    // Draw helicopter rotor
    ctx.fillStyle = '#333';
    ctx.fillRect(-HELICOPTER_WIDTH / 2 - 5, -HELICOPTER_HEIGHT / 2 - 5, HELICOPTER_WIDTH + 10, 5);
    
    // Draw helicopter tail
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(HELICOPTER_WIDTH / 2 - 5, -HELICOPTER_HEIGHT / 4, HELICOPTER_WIDTH / 2, HELICOPTER_HEIGHT / 2);
    
    // Draw helicopter window
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-HELICOPTER_WIDTH / 4, -HELICOPTER_HEIGHT / 4, HELICOPTER_WIDTH / 3, HELICOPTER_HEIGHT / 2);
    
    // Draw thrust effect when thrusting
    if (isThrusting) {
      ctx.fillStyle = '#FF4500';
      ctx.beginPath();
      ctx.moveTo(-HELICOPTER_WIDTH / 2, 0);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 15, -10);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 15, 10);
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw hitbox for debugging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.strokeRect(-HELICOPTER_WIDTH / 2, -HELICOPTER_HEIGHT / 2, HELICOPTER_WIDTH, HELICOPTER_HEIGHT);
    }
    
    // Restore the context state
    ctx.restore();
  }, [isThrusting]);

  // Basic render function to test canvas
  const renderCanvas = useCallback(() => {
    if (!context || !canvas) return;
    
    // Clear the canvas
    context.clearRect(0, 0, width, height);
    
    // Draw the scrolling background
    drawBackground(context, width, height, bgScrollX);
    
    // If game is in START state, draw a message
    if (status === 'START') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(PROJECT_TITLE, width / 2, height / 2 - 20);
      context.font = '18px Arial';
      context.fillText('Tap to start', width / 2, height / 2 + 20);
      
      if (hasPlayedBefore) {
        context.font = '16px Arial';
        context.fillText(`Best Score: ${bestScore}`, width / 2, height / 2 + 60);
        if (lastScore > 0) {
          context.fillText(`Last Score: ${lastScore}`, width / 2, height / 2 + 90);
        }
      }
      
      // Draw a static helicopter in the start screen
      drawHelicopter(context, width / 4, height / 2, 0);
    }
    
    // If game is in PLAYING state, draw score and helicopter
    if (status === 'PLAYING') {
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'right';
      context.textBaseline = 'top';
      context.fillText(`Score: ${score}`, width - 20, 20);
      
      // Draw the helicopter at its current position
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity);
    }
    
    // If game is in GAME_OVER state, draw game over message
    if (status === 'GAME_OVER') {
      // Draw the helicopter in its crashed position
      drawHelicopter(context, heliPosition.x, heliPosition.y, heliVelocity);
      
      // Semi-transparent overlay
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(width / 2 - 150, height / 2 - 100, 300, 200);
      
      context.fillStyle = 'white';
      context.font = '28px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Game Over!', width / 2, height / 2 - 50);
      
      context.font = '20px Arial';
      context.fillText(`Score: ${score}`, width / 2, height / 2);
      
      context.font = '16px Arial';
      context.fillText(`Best Score: ${bestScore}`, width / 2, height / 2 + 30);
      
      // Draw a button-like shape
      context.fillStyle = '#4CAF50';
      context.fillRect(width / 2 - 75, height / 2 + 60, 150, 40);
      
      context.fillStyle = 'white';
      context.font = '16px Arial';
      context.fillText('Play Again', width / 2, height / 2 + 80);
    }
  }, [
    context, 
    canvas, 
    width, 
    height, 
    status, 
    score, 
    bestScore, 
    lastScore, 
    hasPlayedBefore, 
    PROJECT_TITLE, 
    bgScrollX, 
    drawBackground, 
    heliPosition, 
    heliVelocity,
    drawHelicopter
  ]);

  // Update helicopter physics
  const updateHelicopter = useCallback((deltaTime: number) => {
    if (status !== 'PLAYING') return;
    
    // Apply gravity or thrust
    const acceleration = isThrusting ? THRUST : GRAVITY;
    
    // Update velocity with acceleration
    let newVelocity = heliVelocity + acceleration * deltaTime;
    
    // Clamp velocity to maximum
    newVelocity = Math.max(Math.min(newVelocity, MAX_VELOCITY), -MAX_VELOCITY);
    
    // Update position with velocity
    const newY = heliPosition.y + newVelocity * deltaTime;
    
    // Check for collisions with ground or ceiling
    if (newY > height - GROUND_HEIGHT - HELICOPTER_HEIGHT / 2) {
      // Hit the ground
      endGame();
      return;
    }
    
    if (newY < HELICOPTER_HEIGHT / 2) {
      // Hit the ceiling
      setHeliPosition({
        ...heliPosition,
        y: HELICOPTER_HEIGHT / 2
      });
      setHeliVelocity(0);
      return;
    }
    
    // Update state
    setHeliPosition({
      ...heliPosition,
      y: newY
    });
    setHeliVelocity(newVelocity);
  }, [status, heliPosition, heliVelocity, isThrusting, height, endGame]);

  // Use game loop for animation with proper delta time
  useGameLoop((deltaTime) => {
    // Convert milliseconds to seconds for physics calculations
    const dt = deltaTime / 1000;
    
    // Update background scroll position based on game state
    if (status === 'PLAYING') {
      // Update background scroll position
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * dt);
      
      // Update helicopter physics
      updateHelicopter(dt);
    } else if (status === 'START') {
      // Slow scroll in start screen for visual interest
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * 0.2 * dt);
    }
    
    // Render the canvas regardless of game state
    render # Ericsson/codechecker
# -------------------------------------------------------------------------
#
#  Part of the CodeChecker project, under the Apache License v2.0 with
#  LLVM Exceptions. See LICENSE for license information.
#  SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#
# -------------------------------------------------------------------------
"""
Defines the CodeChecker action for parsing a set of analysis results into a
human-readable format.
"""


import argparse
import os
import sys
from typing import Dict, List, Optional, Set, Tuple

from codechecker_report_converter.util import load_json_or_empty

from codechecker_analyzer import analyzer_context
from codechecker_analyzer.analyzers.clangsa.analyzer import ClangSA

from codechecker_common import arg, logger, cmd_config
from codechecker_common.skiplist_handler import SkipListHandler
from codechecker_common.source_code_comment_handler import \
    REVIEW_STATUS_VALUES
from codechecker_common.util import load_json

from codechecker_web.shared import webserver_context

from codechecker_analyzer.analyzers.config_handler import CheckerState

LOG = logger.get_logger('system')


def get_argparser_ctor_args():
    """
    This method returns a dict containing the kwargs for constructing an
    argparse.ArgumentParser (either directly or as a subparser).
    """

    return {
        'prog': 'CodeChecker parse',
        'formatter_class': arg.RawDescriptionDefaultHelpFormatter,

        # Description is shown when the command's help is queried directly
        'description': """
Parse and pretty-print the summary and results from one or more
'codechecker-analyze' result files. Bugs which are commented by using
"false_positive", "suppress" and "intentional" source code comments will not be
printed by the `parse` command.""",

        # Help is shown when the "parent" CodeChecker command lists the
        # individual subcommands.
        'help': "Print analysis summary and results in a human-readable format."
    }


def add_arguments_to_parser(parser):
    """
    Add the subcommand's arguments to the given argparse.ArgumentParser.
    """

    parser.add_argument('input',
                        type=str,
                        nargs='+',
                        metavar='file/folder',
                        help="The analysis result files and/or folders "
                             "containing analysis results which should be "
                             "parsed and printed.")

    cmd_config.add_option(parser)

    parser.add_argument('-t', '--type', '--input-format',
                        dest="input_format",
                        required=False,
                        choices=['plist'],
                        default='plist',
                        help="Specify the format the analysis results were "
                             "created as.")

    output_opts = parser.add_argument_group("export arguments")
    output_opts.add_argument('-e', '--export',
                             dest="export",
                             required=False,
                             choices=['html', 'json', 'codeclimate'],
                             help="Specify extra output format type.")

    output_opts.add_argument('-o', '--output',
                             dest="output_path",
                             default=argparse.SUPPRESS,
                             help="Store the output in the given folder.")

    output_opts.add_argument('-c', '--clean',
                             dest="clean",
                             required=False,
                             action='store_true',
                             default=argparse.SUPPRESS,
                             help="Delete output results stored in the output "
                                  "directory. (By default, it would keep "
                                  "output files and overwrites only those "
                                  "that belong to a bug present in the "
                                  "input.)")

    parser.add_argument('--suppress',
                        type=str,
                        dest="suppress",
                        default=argparse.SUPPRESS,
                        required=False,
                        help="Path of the suppress file to use. Records in "
                             "the suppress file are used to suppress the "
                             "display of certain results when parsing the "
                             "analyses' report. (Reports to an analysis "
                             "result can also be suppressed in the source "
                             "code -- please consult the manual on how to "
                             "do so.) NOTE: The suppress file relies on the "
                             "\"bug identifier\" generated by the analyzers "
                             "which is experimental, take care when relying "
                             "on it.")

    parser.add_argument('--export-source-suppress',
                        dest="create_suppress",
                        action="store_true",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Write suppress data from the suppression "
                             "annotations found in the source files that were "
                             "analyzed earlier that created the results. "
                             "The suppression information will be written "
                             "to the parameter of '--suppress'.")

    parser.add_argument('--print-steps',
                        dest="print_steps",
                        action="store_true",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Print the steps the analyzers took in finding "
                             "the reported defect.")

    parser.add_argument('--trim-path-prefix',
                        type=str,
                        nargs='*',
                        dest="trim_path_prefix",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Removes leading path from files which will be "
                             "printed. For instance if you analyze files "
                             "'/home/jsmith/my-proj/x.cpp' and "
                             "'/home/jsmith/my-proj/y.cpp', but would prefer "
                             "to see just 'x.cpp' and 'y.cpp' in the output, "
                             "invoke CodeChecker with: "
                             "'--%s=/home/jsmith/my-proj'." %
                             'trim-path-prefix')

    parser.add_argument('--review-status',
                        nargs='*',
                        dest="review_status",
                        metavar='REVIEW_STATUS',
                        choices=REVIEW_STATUS_VALUES,
                        default=["confirmed", "unreviewed"],
                        help="Filter results by review status. Valid values "
                             "are: {0}".format(', '.join(REVIEW_STATUS_VALUES))
                             )

    group = parser.add_argument_group("file filter arguments")

    group.add_argument('-i', '--ignore', '--skip',
                       dest="skipfile",
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Path to the Skipfile dictating which project "
                            "files should be omitted from analysis. Please "
                            "consult the User guide on how a Skipfile "
                            "should be laid out.")

    group.add_argument('--file',
                       nargs='+',
                       dest="files",
                       metavar='FILE',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by file path. "
                            "The file path can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more). So if you have "
                            "/a/x.cpp and /a/y.cpp then \"/a/*.cpp\" "
                            "selects both.")

    group.add_argument('--checker-name',
                       nargs='+',
                       dest="checker_names",
                       metavar='CHECKER_NAME',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by checker names. "
                            "The checker name can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more). So for example "
                            "\"*DeadStores\" will matches "
                            "\"deadcode.DeadStores\"")

    group.add_argument('-s', '--severity',
                       nargs='+',
                       dest="severity",
                       metavar='SEVERITY',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by severity level. "
                            "Critical, high, medium, low, style, unspecified")

    group.add_argument('--checker-msg',
                       nargs='+',
                       dest="checker_msg",
                       metavar='CHECKER_MSG',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by checker message. "
                            "The checker message can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more).")

    group.add_argument('--analyzer-name',
                       nargs='+',
                       dest="analyzer_names",
                       metavar='ANALYZER_NAME',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by analyzer names. "
                            "Currently supported analyzers are: "
                            "clangsa, clang-tidy.")

    group.add_argument('--tag',
                       nargs='+',
                       dest="tag",
                       metavar='TAG',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by version tag names.")

    group.add_argument('--file-status',
                       nargs='+',
                       dest="file_status",
                       metavar='FILE_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by file status. "
                            "Valid values are: unresolved, resolved, "
                            "off and all. Files are considered as "
                            "resolved when they are not available "
                            "during the analysis anymore. Off status "
                            "indicates that the file is available but "
                            "there is no report for this file in the "
                            "latest analysis. All status incorporates "
                            "all of the above.")

    group.add_argument('--report-status',
                       nargs='+',
                       dest="report_status",
                       metavar='REPORT_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by report status. "
                            "Valid values are: new, resolved, "
                            "unresolved and reopened.")

    group.add_argument('--report-hash',
                       nargs='+',
                       dest="report_hash",
                       metavar='REPORT_HASH',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by report hash.")

    group.add_argument('--detection-status',
                       nargs='+',
                       dest="detection_status",
                       metavar='DETECTION_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by detection statuses. "
                            "Valid values are: new, unresolved, "
                            "resolved, reopened, off and unavailable.")

    group.add_argument('--unique',
                       dest="uniqueing",
                       required=False,
                       default="off",
                       choices=["on", "off"],
                       help="Uniqueing mode. "
                            "report results only once "
                            "across all analyzers. "
                            "If uniqueing is enabled, "
                            "all reports that refer to "
                            "the same source code line "
                            "and have the same checker message "
                            "will be uniqued and only the most "
                            "severe report will be shown.")

    logger.add_verbose_arguments(parser)
    parser.set_defaults(func=main)


def main(args):
    """
    Entry point for parsing some analysis results and printing them to the
    stdout in a human-readable format.
    """
    logger.setup_logger(args.verbose if 'verbose' in args else None)

    try:
        cmd_config.check_config_file(args)
    except FileNotFoundError as fnerr:
        LOG.error(fnerr)
        sys.exit(1)

    export = args.export if 'export' in args else None
    if export == 'html' and 'output_path' not in args:
        LOG.error("Argument --output is required if HTML output is used.")
        sys.exit(1)

    if export == 'json' and 'output_path' not in args:
        LOG.error("Argument --output is required if JSON output is used.")
        sys.exit(1)

    if export == 'codeclimate' and 'output_path' not in args:
        LOG.error("Argument --output is required if Code Climate output is "
                  "used.")
        sys.exit(1)

    if 'clean' in args and 'output_path' not in args:
        LOG.error("Argument --output is required if --clean is used.")
        sys.exit(1)

    if 'output_path' in args and not export:
        LOG.error("Argument --export not specified (or set to None), but "
                  "output is requested. Exiting.")
        sys.exit(1)

    if 'suppress' in args and 'create_suppress' in args:
        LOG.error("'--suppress' and '--export-source-suppress' cannot be "
                  "given at the same time.")
        sys.exit(1)

    if 'create_suppress' in args:
        if 'suppress' not in args:
            LOG.error("Missing --suppress SUPPRESS_FILE from the command line "
                      "which is required for --export-source-suppress.")
            sys.exit(1)

        if os.path.exists(args.suppress):
            LOG.warning("Previous suppress file '%s' will be overwritten.",
                        args.suppress)

    # We set up the simplest of configurations.
    cfg_dict = {
        'analyze': {
            'checker_config': {}
        }
    }
    cfg_dict.update(ClangSA.get_analyzer_config())

    context = analyzer_context.get_context()
    context.codechecker_workspace = None
    context.checker_labels = []
    context.analyzer_config = cfg_dict

    # To ensure the help message prints the default folder properly,
    # the 'default' for 'args.input' is a string, not a list.
    # But we need lists for the foreach here to work.
    if isinstance(args.input, str):
        args.input = [args.input]

    src_comment_status_filter = args.review_status

    suppr_handler = None
    if 'suppress' in args:
        __make_handler = False
        if not os.path.isfile(args.suppress):
            if 'create_suppress' in args:
                with open(args.suppress, 'w',
                          encoding='utf-8', errors='ignore') as _:
                    # Just create the file.
                    __make_handler = True
                    LOG.info("Will write source code suppressions to "
                             "suppress file: %s", args.suppress)
            else:
                LOG.warning("Suppress file '%s' given, but it does not exist"
                            " -- will not suppress anything.", args.suppress)
        else:
            __make_handler = True

        if __make_handler:
            suppr_handler = suppress_handler.get_suppress_data(args.suppress)

    trim_path_prefixes = []
    if 'trim_path_prefix' in args:
        trim_path_prefixes = args.trim_path_prefix

    skip_handler = None
    if 'skipfile' in args:
        if not os.path.exists(args.skipfile):
            LOG.error("Skip file not found: %s", args.skipfile)
            sys.exit(1)

        skip_handler = SkipListHandler(args.skipfile)

    html_builder: Optional[HtmlBuilder] = None

    # Get the checkers.
    clangsa_config = context.analyzer_config.get('clangsa')
    config_handler = ClangSA.construct_config_handler(clangsa_config)
    checkers = ClangSA.get_analyzer_checkers(config_handler)

    # Processing PList files.
    if 'output_path' in args:
        output_dir = args.output_path
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        html_builder = HtmlBuilder(
            output_dir, args.input, args.input_format)

        if 'clean' in args:
            html_builder.clean()

    all_reports = []
    files = []
    for input_path in args.input:
        input_path = os.path.abspath(input_path)
        if os.path.exists(input_path):
            files.append(input_path)
        else:
            LOG.warning("Input argument %s does not exist", input_path)

    file_report_map = defaultdict(list)

    if 'uniqueing' in args:
        uniqueing = args.uniqueing
    else:
        uniqueing = 'off'

    if uniqueing == 'on':
        statistics_data = defaultdict(int)
    else:
        statistics_data = {}

    report_filter = ReportFilter(args, suppr_handler, skip_handler,
                                 src_comment_status_filter)

    for file_path in files:
        reports = []
        if os.path.isfile(file_path):
            reports = report_filter.filter_reports_by_path(file_path)
        elif os.path.isdir(file_path):
            reports = report_filter.filter_reports_in_dir(file_path)

        all_reports.extend(reports)

        for report in reports:
            file_path = report.file_path
            if file_path not in file_report_map:
                file_report_map[file_path] = []

            file_report_map[file_path].append(report)

    if 'create_suppress' in args:
        export_source_suppress(suppr_handler, args.suppress,
                               file_report_map)
        sys.exit(0)

    print_reports(all_reports, file_report_map, suppr_handler,
                  checkers, trim_path_prefixes, args.print_steps,
                  uniqueing, statistics_data)

    if html_builder:
        LOG.info("Generating HTML output files to file://%s "
                 "directory", output_dir)

        html_builder.create(all_reports)

    if 'output_path' in args and export == 'json':
        output_path = os.path.join(args.output_path, 'reports.json')
        reports_helper.dump_report_to_json_file(all_reports, output_path)
        LOG.info("Generating JSON output files to file://%s "
                 "directory", args.output_path)

    if 'output_path' in args and export == 'codeclimate':
        output_path = os.path.join(args.output_path, 'reports.json')
        reports_helper.dump_report_to_codeclimate_file(all_reports, output_path)
        LOG.info("Generating Code Climate output files to file://%s "
                 "directory", args.output_path)

    # Create index.html and statistics.html for the generated html files.
    if html_builder:
        html_builder.create_index_html(args.input)
        html_builder.create_statistics_html()

    if len(all_reports) > 0:
        sys.exit(2)
    else:
        sys.exit(0)


def print_reports(reports, file_report_map, suppr_handler, checkers,
                  trim_path_prefixes, print_steps, uniqueing, statistics_data):
    """
    Print the reports to the standard output.
    """

    if reports:
        if 'print_steps' in args:
            reports_helper.dump_report_to_stdout(reports, file_report_map,
                                                 suppr_handler, checkers,
                                                 trim_path_prefixes,
                                                 args.print_steps)
        else:
            reports_helper.dump_report_to_stdout(reports, file_report_map,
                                                 suppr_handler, checkers,
                                                 trim_path_prefixes)

    if uniqueing == 'on':
        for report_hash, count in statistics_data.items():
            LOG.warning("Same report hash '%s' found %d times!",
                        report_hash, count)


def export_source_suppress(suppr_handler, source_suppress_file,
                           file_report_map):
    """
    Export source suppression information for the given report to the
    suppress file.
    """

    if not suppr_handler:
        return

    LOG.info("Writing source code suppressions to %s", source_suppress_file)

    source_suppress = []
    for reports in file_report_map.values():
        for report in reports:
            source_suppress.append(suppress_handler.create_suppress_data(
                report.report_hash,
                report.file_path,
                report.checker_name,
                report.line,
                report.column,
                report.message,
                'false_positive',
                'suppress all'))

    suppress_handler.write_to_suppress_file(source_suppress,
                                            source_suppress_file)


class ReportFilter:
    """
    Filter reports based on filter set configuration.
    """

    def __init__(self, args, suppr_handler, skip_handler,
                 src_comment_status_filter):

        self._args = args
        self._suppr_handler = suppr_handler
        self._skip_handler = skip_handler
        self._src_comment_status_filter = src_comment_status_filter

    def filter_reports_by_path(self, input_path: str) -> List[Report]:
        """
        Returns report files that can be found in the input path.
        """
        if not os.path.exists(input_path):
            return []

        if os.path.isfile(input_path):
            reports = self.__get_reports([input_path])
            return self.__filter_reports(reports)

        if os.path.isdir(input_path):
            return self.filter_reports_in_dir(input_path)

        return []

    def filter_reports_in_dir(self, dir_path: str) -> List[Report]:
        """
        Returns report files that can be found in the input directory path.
        """
        if not os.path.exists(dir_path):
            return []

        if not os.path.isdir(dir_path):
            return self.filter_reports_by_path(dir_path)

        ret = []
        for dirpath, _, filenames in os.walk(dir_path):
            for f in filenames:
                if f == 'reports.json':
                    ret.extend(self.filter_reports_by_path(
                        os.path.join(dirpath, f)))

                if not f.endswith('.plist'):
                    continue

                ret.extend(self.filter_reports_by_path(
                    os.path.join(dirpath, f)))

        return ret

    def __get_reports(self, plist_files: List[str]) -> List[Report]:
        """
        Get reports from the given report files.
        """
        all_reports = []
        for f in plist_files:
            if not f.endswith(".plist"):
                continue

            LOG.debug("Parsing '%s'", f)
            try:
                files, reports = plist_parser.parse_plist_file(f)
                for report in reports:
                    report.main['location']['file_name'] = \
                        files[report.main['location']['file']]
                all_reports.extend(reports)
            except Exception as ex:
                LOG.error('The generated plist is not valid!')
                LOG.error(ex)
        return all_reports

    def __filter_reports(self, reports: List[Report]) -> List[Report]:
        """
        Filter the reports based on filter set configuration.
        """
        filtered_reports = []

        for report in reports:
            path = report.file_path

            if 'report_hash' in self._args and report.report_hash not in \
                    self._args.report_hash:
                continue

            if 'checker_names' in self._args:
                checker_name = report.checker_name
                if not any([re.match(r'^' + c.replace("*", ".*") + '$',
                                     checker_name, re.IGNORECASE)
                            for c in self._args.checker_names]):
                    continue

            if 'file_status' in self._args:
                if report.file_status not in self._args.file_status:
                    continue

            if 'report_status' in self._args:
                if report.detection_status not in self._args.report_status:
                    continue

            if 'detection_status' in self._args:
                if report.detection_status not in self._args.detection_status:
                    continue

            if 'analyzer_names' in self._args:
                if report.analyzer_name not in self._args.analyzer_names:
                    continue

            if 'tag' in self._args:
                if report.tag not in self._args.tag:
                    continue

            if 'checker_msg' in self._args:
                checker_msg = report.message
                if not any([re.match(r'^' + c.replace("*", ".*") + '$',
                                     checker_msg, re.IGNORECASE)
                            for c in self._args.checker_msg]):
                    continue

            if 'severity' in self._args:
                if report.severity not in self._args.severity:
                    continue

            if 'files' in self._args:
                if not any([re.match(r'^' + f.replace("*", ".*") + '$',
                                     path, re.IGNORECASE)
                            for f in self._args.files]):
                    continue

            if self._skip_handler and self._skip_handler.should_skip(path):
                continue

            if self._suppr_handler and \
                    self._suppr_handler.get_suppressed(report.report_hash,
                                                       path,
                                                       report.checker_name,
                                                       report.line,
                                                       report.column,
                                                       report.message):
                continue

            # Filter reports by source code comments.
            if self._src_comment_status_filter:
                comment_data = report.get_comment_data()
                if comment_data and \
                        comment_data.status not in \
                        self._src_comment_status_filter:
                    continue

            filtered_reports.append(report)

        return filtered_reports
Canvas();
  }, [
    context, 
    canvas, 
    width, 
    height, 
    status, 
    score, 
    bestScore, 
    lastScore, 
    hasPlayedBefore, 
    PROJECT_TITLE, 
    bgScrollX, 
    drawBackground, 
    heliPosition, 
    heliVelocity,
    drawHelicopter
  ]);

  // Update helicopter physics
  const updateHelicopter = useCallback((deltaTime: number) => {
    if (status !== 'PLAYING') return;
    
    // Apply gravity or thrust
    const acceleration = isThrusting ? THRUST : GRAVITY;
    
    // Update velocity with acceleration
    let newVelocity = heliVelocity + acceleration * deltaTime;
    
    // Clamp velocity to maximum
    newVelocity = Math.max(Math.min(newVelocity, MAX_VELOCITY), -MAX_VELOCITY);
    
    // Update position with velocity
    const newY = heliPosition.y + newVelocity * deltaTime;
    
    // Check for collisions with ground or ceiling
    if (newY > height - GROUND_HEIGHT - HELICOPTER_HEIGHT / 2) {
      // Hit the ground
      endGame();
      return;
    }
    
    if (newY < HELICOPTER_HEIGHT / 2) {
      // Hit the ceiling
      setHeliPosition({
        ...heliPosition,
        y: HELICOPTER_HEIGHT / 2
      });
      setHeliVelocity(0);
      return;
    }
    
    // Update state
    setHeliPosition({
      ...heliPosition,
      y: newY
    });
    setHeliVelocity(newVelocity);
  }, [status, heliPosition, heliVelocity, isThrusting, height, endGame]);

  // Use game loop for animation with proper delta time
  useGameLoop((deltaTime) => {
    // Update background scroll position based on game state
    if (status === 'PLAYING') {
      // Update background scroll position
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * deltaTime);
      
      // Update helicopter physics
      updateHelicopter(deltaTime);
    } else if (status === 'START') {
      // Slow scroll in start screen for visual interest
      setBgScrollX(prevScrollX => prevScrollX + BACKGROUND_SCROLL_SPEED * 0.2 * deltaTime);
    }
    
    // Render the canvas regardless of game state
    renderCanvas();
  }, !!context && !!canvas);

  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx);
        setAdded(ctx?.client?.added || false);

        // If frame isn't already added, prompt user to add it
        if (!ctx?.client?.added) {
          addFrame();
        }

        sdk.on("frameAdded", () => {
          setAdded(true);
        });

        sdk.on("frameRemoved", () => {
          setAdded(false);
        });

        // Signal that the frame is ready
        sdk.actions.ready({});
      } catch (error) {
        console.error("Error loading SDK context:", error);
      }
    };

    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  // Add click/touch handler to the game container
  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container) return;

    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      if (status === 'START') {
        startGame();
      } else if (status === 'GAME_OVER') {
        // Check if click is on the Play Again button
        if (context && canvas) {
          const rect = canvas.getBoundingClientRect();
          const x = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
          const y = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
          
          // Convert to canvas coordinates
          const canvasX = x - rect.left;
          const canvasY = y - rect.top;
          
          // Check if click is within button bounds
          if (
            canvasX >= width / 2 - 75 &&
            canvasX <= width / 2 + 75 &&
            canvasY >= height / 2 + 60 &&
            canvasY <= height / 2 + 100
          ) {
            restartGame();
          }
        }
      }
    };

    container.addEventListener('click', handleInteraction);
    container.addEventListener('touchstart', handleInteraction);

    return () => {
      container.removeEventListener('click', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
    };
  }, [status, startGame, restartGame, context, canvas, width, height]);

  // Handle pointer down/up for helicopter thrust
  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container) return;
    
    const handlePointerDown = () => {
      if (status === 'PLAYING') {
        setIsThrusting(true);
      }
    };
    
    const handlePointerUp = () => {
      setIsThrusting(false);
    };
    
    container.addEventListener('mousedown', handlePointerDown);
    container.addEventListener('touchstart', handlePointerDown);
    container.addEventListener('mouseup', handlePointer # Ericsson/codechecker
# -------------------------------------------------------------------------
#
#  Part of the CodeChecker project, under the Apache License v2.0 with
#  LLVM Exceptions. See LICENSE for license information.
#  SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#
# -------------------------------------------------------------------------
"""
Defines the CodeChecker action for parsing a set of analysis results into a
human-readable format.
"""


import argparse
import os
import sys
from typing import Dict, List, Optional, Set, Tuple

from codechecker_report_converter.util import load_json_or_empty

from codechecker_analyzer import analyzer_context
from codechecker_analyzer.analyzers.clangsa.analyzer import ClangSA

from codechecker_common import arg, logger, cmd_config
from codechecker_common.skiplist_handler import SkipListHandler
from codechecker_common.source_code_comment_handler import \
    REVIEW_STATUS_VALUES
from codechecker_common.util import load_json

from codechecker_web.shared import webserver_context

from codechecker_analyzer.analyzers.config_handler import CheckerState

LOG = logger.get_logger('system')


def get_argparser_ctor_args():
    """
    This method returns a dict containing the kwargs for constructing an
    argparse.ArgumentParser (either directly or as a subparser).
    """

    return {
        'prog': 'CodeChecker parse',
        'formatter_class': arg.RawDescriptionDefaultHelpFormatter,

        # Description is shown when the command's help is queried directly
        'description': """
Parse and pretty-print the summary and results from one or more
'codechecker-analyze' result files. Bugs which are commented by using
"false_positive", "suppress" and "intentional" source code comments will not be
printed by the `parse` command.""",

        # Help is shown when the "parent" CodeChecker command lists the
        # individual subcommands.
        'help': "Print analysis summary and results in a human-readable format."
    }


def add_arguments_to_parser(parser):
    """
    Add the subcommand's arguments to the given argparse.ArgumentParser.
    """

    parser.add_argument('input',
                        type=str,
                        nargs='+',
                        metavar='file/folder',
                        help="The analysis result files and/or folders "
                             "containing analysis results which should be "
                             "parsed and printed.")

    cmd_config.add_option(parser)

    parser.add_argument('-t', '--type', '--input-format',
                        dest="input_format",
                        required=False,
                        choices=['plist'],
                        default='plist',
                        help="Specify the format the analysis results were "
                             "created as.")

    output_opts = parser.add_argument_group("export arguments")
    output_opts.add_argument('-e', '--export',
                             dest="export",
                             required=False,
                             choices=['html', 'json', 'codeclimate'],
                             help="Specify extra output format type.")

    output_opts.add_argument('-o', '--output',
                             dest="output_path",
                             default=argparse.SUPPRESS,
                             help="Store the output in the given folder.")

    output_opts.add_argument('-c', '--clean',
                             dest="clean",
                             required=False,
                             action='store_true',
                             default=argparse.SUPPRESS,
                             help="Delete output results stored in the output "
                                  "directory. (By default, it would keep "
                                  "output files and overwrites only those "
                                  "that belong to a bug present in the "
                                  "input.)")

    parser.add_argument('--suppress',
                        type=str,
                        dest="suppress",
                        default=argparse.SUPPRESS,
                        required=False,
                        help="Path of the suppress file to use. Records in "
                             "the suppress file are used to suppress the "
                             "display of certain results when parsing the "
                             "analyses' report. (Reports to an analysis "
                             "result can also be suppressed in the source "
                             "code -- please consult the manual on how to "
                             "do so.) NOTE: The suppress file relies on the "
                             "\"bug identifier\" generated by the analyzers "
                             "which is experimental, take care when relying "
                             "on it.")

    parser.add_argument('--export-source-suppress',
                        dest="create_suppress",
                        action="store_true",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Write suppress data from the suppression "
                             "annotations found in the source files that were "
                             "analyzed earlier that created the results. "
                             "The suppression information will be written "
                             "to the parameter of '--suppress'.")

    parser.add_argument('--print-steps',
                        dest="print_steps",
                        action="store_true",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Print the steps the analyzers took in finding "
                             "the reported defect.")

    parser.add_argument('--trim-path-prefix',
                        type=str,
                        nargs='*',
                        dest="trim_path_prefix",
                        required=False,
                        default=argparse.SUPPRESS,
                        help="Removes leading path from files which will be "
                             "printed. For instance if you analyze files "
                             "'/home/jsmith/my-proj/x.cpp' and "
                             "'/home/jsmith/my-proj/y.cpp', but would prefer "
                             "to see just 'x.cpp' and 'y.cpp' in the output, "
                             "invoke CodeChecker with: "
                             "'--%s=/home/jsmith/my-proj'." %
                             'trim-path-prefix')

    parser.add_argument('--review-status',
                        nargs='*',
                        dest="review_status",
                        metavar='REVIEW_STATUS',
                        choices=REVIEW_STATUS_VALUES,
                        default=["confirmed", "unreviewed"],
                        help="Filter results by review status. Valid values "
                             "are: {0}".format(', '.join(REVIEW_STATUS_VALUES))
                             )

    group = parser.add_argument_group("file filter arguments")

    group.add_argument('-i', '--ignore', '--skip',
                       dest="skipfile",
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Path to the Skipfile dictating which project "
                            "files should be omitted from analysis. Please "
                            "consult the User guide on how a Skipfile "
                            "should be laid out.")

    group.add_argument('--file',
                       nargs='+',
                       dest="files",
                       metavar='FILE',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by file path. "
                            "The file path can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more). So if you have "
                            "/a/x.cpp and /a/y.cpp then \"/a/*.cpp\" "
                            "selects both.")

    group.add_argument('--checker-name',
                       nargs='+',
                       dest="checker_names",
                       metavar='CHECKER_NAME',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by checker names. "
                            "The checker name can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more). So for example "
                            "\"*DeadStores\" will matches "
                            "\"deadcode.DeadStores\"")

    group.add_argument('-s', '--severity',
                       nargs='+',
                       dest="severity",
                       metavar='SEVERITY',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by severity level. "
                            "Critical, high, medium, low, style, unspecified")

    group.add_argument('--checker-msg',
                       nargs='+',
                       dest="checker_msg",
                       metavar='CHECKER_MSG',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by checker message. "
                            "The checker message can contain multiple * "
                            "quantifiers which matches any number of "
                            "characters (zero or more).")

    group.add_argument('--analyzer-name',
                       nargs='+',
                       dest="analyzer_names",
                       metavar='ANALYZER_NAME',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by analyzer names. "
                            "Currently supported analyzers are: "
                            "clangsa, clang-tidy.")

    group.add_argument('--tag',
                       nargs='+',
                       dest="tag",
                       metavar='TAG',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by version tag names.")

    group.add_argument('--file-status',
                       nargs='+',
                       dest="file_status",
                       metavar='FILE_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by file status. "
                            "Valid values are: unresolved, resolved, "
                            "off and all. Files are considered as "
                            "resolved when they are not available "
                            "during the analysis anymore. Off status "
                            "indicates that the file is available but "
                            "there is no report for this file in the "
                            "latest analysis. All status incorporates "
                            "all of the above.")

    group.add_argument('--report-status',
                       nargs='+',
                       dest="report_status",
                       metavar='REPORT_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by report status. "
                            "Valid values are: new, resolved, "
                            "unresolved and reopened.")

    group.add_argument('--report-hash',
                       nargs='+',
                       dest="report_hash",
                       metavar='REPORT_HASH',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by report hash.")

    group.add_argument('--detection-status',
                       nargs='+',
                       dest="detection_status",
                       metavar='DETECTION_STATUS',
                       required=False,
                       default=argparse.SUPPRESS,
                       help="Filter results by detection statuses. "
                            "Valid values are: new, unresolved, "
                            "resolved, reopened, off and unavailable.")

    group.add_argument('--unique',
                       dest="uniqueing",
                       required=False,
                       default="off",
                       choices=["on", "off"],
                       help="Uniqueing mode. "
                            "report results only once "
                            "across all analyzers. "
                            "If uniqueing is enabled, "
                            "all reports that refer to "
                            "the same source code line "
                            "and have the same checker message "
                            "will be uniqued and only the most "
                            "severe report will be shown.")

    logger.add_verbose_arguments(parser)
    parser.set_defaults(func=main)


def main(args):
    """
    Entry point for parsing some analysis results and printing them to the
    stdout in a human-readable format.
    """
    logger.setup_logger(args.verbose if 'verbose' in args else None)

    try:
        cmd_config.check_config_file(args)
    except FileNotFoundError as fnerr:
        LOG.error(fnerr)
        sys.exit(1)

    export = args.export if 'export' in args else None
    if export == 'html' and 'output_path' not in args:
        LOG.error("Argument --output is required if HTML output is used.")
        sys.exit(1)

    if export == 'json' and 'output_path' not in args:
        LOG.error("Argument --output is required if JSON output is used.")
        sys.exit(1)

    if export == 'codeclimate' and 'output_path' not in args:
        LOG.error("Argument --output is required if Code Climate output is "
                  "used.")
        sys.exit(1)

    if 'clean' in args and 'output_path' not in args:
        LOG.error("Argument --output is required if --clean is used.")
        sys.exit(1)

    if 'output_path' in args and not export:
        LOG.error("Argument --export not specified (or set to None), but "
                  "output is requested. Exporting disabled.")

    if 'suppress' in args and 'create_suppress' in args:
        LOG.error("'--suppress' and '--export-source-suppress' cannot be "
                  "given at the same time.")
        sys.exit(1)

    if 'create_suppress' in args:
        if 'suppress' not in args:
            LOG.error("Missing --suppress SUPPRESS_FILE from the command line "
                      "which is required for --export-source-suppress.")
            sys.exit(1)

        if os.path.exists(args.suppress):
            LOG.warning("Previous suppress file '%s' will be overwritten.",
                        args.suppress)

    # We set up the simplest of configurations.
    cfg_dict = {
        'analyze': {
            'checker_config': {}
        }
    }
    cfg_dict.update(ClangSA.get_analyzer_config())

    context = analyzer_context.get_context()
    context.codechecker_workspace = None
    context.checker_labels = []
    context.analyzer_config = cfg_dict

    # To ensure the help message prints the default folder properly,
    # the 'default' for 'args.input' is a string, not a list.
    # But we need lists for the foreach here to work.
    if isinstance(args.input, str):
        args.input = [args.input]

    src_comment_status_filter = args.review_status

    suppr_handler = None
    if 'suppress' in args:
        __make_handler = False
        if not os.path.isfile(args.suppress):
            if 'create_suppress' in args:
                with open(args.suppress, 'w',
                          encoding='utf-8', errors='ignore') as _:
                    # Just create the file.
                    __make_handler = True
                    LOG.info("Will write source code suppressions to "
                             "suppress file: %s", args.suppress)
            else:
                LOG.warning("Suppress file '%s' given, but it does not exist"
                            " -- will not suppress anything.", args.suppress)
        else:
            __make_handler = True

        if __make_handler:
            suppr_handler = suppress_handler.get_suppress_data(args.suppress)

    trim_path_prefixes = []
    if 'trim_path_prefix' in args:
        trim_path_prefixes = args.trim_path_prefix

    skip_handler = None
    if 'skipfile' in args:
        if not os.path.exists(args.skipfile):
            LOG.error("Skip file not found: %s", args.skipfile)
            sys.exit(1)

        skip_handler = SkipListHandler(args.skipfile)

    html_builder: Optional[HtmlBuilder] = None

    # Get the checkers.
    clangsa_config = context.analyzer_config.get('clangsa')
    config_handler = ClangSA.construct_config_handler(clangsa_config)
    checkers = ClangSA.get_analyzer_checkers(config_handler)

    # Processing PList files.
    if 'output_path' in args and export:
        output_dir = args.output_path
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        html_builder = HtmlBuilder(
            output_dir, args.input, args.input_format)

        if 'clean' in args:
            html_builder.clean()

    all_reports = []
    files = []
    for input_path in args.input:
        input_path = os.path.abspath(input_path)
        if os.path.exists(input_path):
            files.append(input_path)
        else:
            LOG.warning("Input argument %s does not exist", input_path)

    file_report_map = defaultdict(list)

    if 'uniqueing' in args:
        uniqueing = args.uniqueing
    else:
        uniqueing = 'off'

    if uniqueing == 'on':
        statistics_data = defaultdict(int)
    else:
        statistics_data = {}

    report_filter = ReportFilter(args, suppr_handler, skip_handler,
                                 src_comment_status_filter)

    for file_path in files:
        reports = []
        if os.path.isfile(file_path):
            reports = report_filter.filter_reports_by_path(file_path)
        elif os.path.isdir(file_path):
            reports = report_filter.filter_reports_in_dir(file_path)

        all_reports.extend(reports)

        for report in reports:
            file_path = report.file_path
            if file_path not in file_report_map:
                file_report_map[file_path] = []

            file_report_map[file_path].append(report)

    if 'create_suppress' in args:
        export_source_suppress(suppr_handler, args.suppress,
                               file_report_map)
        sys.exit(0)

    print_reports(all_reports, file_report_map, suppr_handler,
                  checkers, trim_path_prefixes, args.print_steps,
                  uniqueing, statistics_data)

    if html_builder:
        LOG.info("Generating HTML output files to file://%s "
                 "directory", output_dir)

        html_builder.create(all_reports)

    if 'output_path' in args and export == 'json':
        output_path = os.path.join(args.output_path, 'reports.json')
        reports_helper.dump_report_to_json_file(all_reports, output_path)
        LOG.info("Generating JSON output files to file://%s "
                 "directory", args.output_path)

    if 'output_path' in args and export == 'codeclimate':
        output_path = os.path.join(args.output_path, 'reports.json')
        reports_helper.dump_report_to_codeclimate_file(all_reports, output_path)
        LOG.info("Generating Code Climate output files to file://%s "
                 "directory", args.output_path)

    # Create index.html and statistics.html for the generated html files.
    if html_builder:
        html_builder.create_index_html(args.input)
        html_builder.create_statistics_html()

    if len(all_reports) > 0:
        sys.exit(2)
    else:
        sys.exit(0)


def print_reports(reports, file_report_map, suppr_handler, checkers,
                  trim_path_prefixes, print_steps, uniqueing, statistics_data):
    """
    Print the reports to the standard output.
    """

    if reports:
        if 'print_steps' in args:
            reports_helper.dump_report_to_stdout(reports, file_report_map,
                                                 suppr_handler, checkers,
                                                 trim_path_prefixes,
                                                 args.print_steps)
        else:
            reports_helper.dump_report_to_stdout(reports, file_report_map,
                                                 suppr_handler, checkers,
                                                 trim_path_prefixes)

    if uniqueing == 'on':
        for report_hash, count in statistics_data.items():
            LOG.warning("Same report hash '%s' found %d times!",
                        report_hash, count)


def export_source_suppress(suppr_handler, source_suppress_file,
                           file_report_map):
    """
    Export source suppression information for the given report to the
    suppress file.
    """

    if not suppr_handler:
        return

    LOG.info("Writing source code suppressions to %s", source_suppress_file)

    source_suppress = []
    for reports in file_report_map.values():
        for report in reports:
            source_suppress.append(suppress_handler.create_suppress_data(
                report.report_hash,
                report.file_path,
                report.checker_name,
                report.line,
                report.column,
                report.message,
                'false_positive',
                'suppress all'))

    suppress_handler.write_to_suppress_file(source_suppress,
                                            source_suppress_file)


class ReportFilter:
    """
    Filter reports based on filter set configuration.
    """

    def __init__(self, args, suppr_handler, skip_handler,
                 src_comment_status_filter):

        self._args = args
        self._suppr_handler = suppr_handler
        self._skip_handler = skip_handler
        self._src_comment_status_filter = src_comment_status_filter

    def filter_reports_by_path(self, input_path: str) -> List[Report]:
        """
        Returns report files that can be found in the input path.
        """
        if not os.path.exists(input_path):
            return []

        if os.path.isfile(input_path):
            reports = self.__get_reports([input_path])
            return self.__filter_reports(reports)

        if os.path.isdir(input_path):
            return self.filter_reports_in_dir(input_path)

        return []

    def filter_reports_in_dir(self, dir_path: str) -> List[Report]:
        """
        Returns report files that can be found in the input directory path.
        """
        if not os.path.exists(dir_path):
            return []

        if not os.path.isdir(dir_path):
            return self.filter_reports_by_path(dir_path)

        ret = []
        for dirpath, _, filenames in os.walk(dir_path):
            for f in filenames:
                if f == 'reports.json':
                    ret.extend(self.filter_reports_by_path(
                        os.path.join(dirpath, f)))

                if not f.endswith('.plist'):
                    continue

                ret.extend(self.filter_reports_by_path(
                    os.path.join(dirpath, f)))

        return ret

    def __get_reports(self, plist_files: List[str]) -> List[Report]:
        """
        Get reports from the given report files.
        """
        all_reports = []
        for f in plist_files:
            if not f.endswith(".plist"):
                continue

            LOG.debug("Parsing '%s'", f)
            try:
                files, reports = plist_parser.parse_plist_file(f)
                for report in reports:
                    report.main['location']['file_name'] = \
                        files[report.main['location']['file']]
                all_reports.extend(reports)
            except Exception as ex:
                LOG.error('The generated plist is not valid!')
                LOG.error(ex)
        return all_reports

    def __filter_reports(self, reports: List[Report]) -> List[Report]:
        """
        Filter the reports based on filter set configuration.
        """
        filtered_reports = []

        for report in reports:
            path = report.file_path

            if 'report_hash' in self._args and report.report_hash not in \
                    self._args.report_hash:
                continue

            if 'checker_names' in self._args:
                checker_name = report.checker_name
                if not any([re.match(r'^' + c.replace("*", ".*") + '$',
                                     checker_name, re.IGNORECASE)
                            for c in self._args.checker_names]):
                    continue

            if 'file_status' in self._args:
                if report.file_status not in self._args.file_status:
                    continue

            if 'report_status' in self._args:
                if report.detection_status not in self._args.report_status:
                    continue

            if 'detection_status' in self._args:
                if report.detection_status not in self._args.detection_status:
                    continue

            if 'analyzer_names' in self._args:
                if report.analyzer_name not in self._args.analyzer_names:
                    continue

            if 'tag' in self._args:
                if report.tag not in self._args.tag:
                    continue

            if 'checker_msg' in self._args:
                checker_msg = report.message
                if not any([re.match(r'^' + c.replace("*", ".*") + '$',
                                     checker_msg, re.IGNORECASE)
                            for c in self._args.checker_msg]):
                    continue

            if 'severity' in self._args:
                if report.severity not in self._args.severity:
                    continue

            if 'files' in self._args:
                if not any([re.match(r'^' + f.replace("*", ".*") + '$',
                                     path, re.IGNORECASE)
                            for f in self._args.files]):
                    continue

            if self._skip_handler and self._skip_handler.should_skip(path):
                continue

            if self._suppr_handler and \
                    self._suppr_handler.get_suppressed(report.report_hash,
                                                       path,
                                                       report.checker_name,
                                                       report.line,
                                                       report.column,
                                                       report.message):
                continue

            # Filter reports by source code comments.
            if self._src_comment_status_filter:
                comment_data = report.get_comment_data()
                if comment_data and \
                        comment_data.status not in \
                        self._src_comment_status_filter:
                    continue

            filtered_reports.append(report)

        return filtered_reports
Up);
    
    // Also listen for pointer leaving the container
    container.addEventListener('mouseleave', handlePointerUp);
    container.addEventListener('touchcancel', handlePointerUp);
    
    return () => {
      container.removeEventListener('mousedown', handlePointerDown);
      container.removeEventListener('touchstart', handlePointerDown);
      container.removeEventListener('mouseup', handlePointerUp);
      container.removeEventListener('touchend', handlePointerUp);
      container.removeEventListener('mouseleave', handlePointerUp);
      container.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [status]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client?.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client?.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client?.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client?.safeAreaInsets?.right ?? 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div 
        ref={gameContainerRef}
        id="game-container"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "500px",
          maxHeight: "800px",
          backgroundColor: "#87CEEB", // Sky blue background
          position: "relative",
          overflow: "hidden",
          touchAction: "none", // Prevent default touch actions
        }}
      />
    </div>
  );
}
