import { useState, useEffect, useRef } from 'react';

// 1. 타입 정의 (TypeScript)
interface FlowNode {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface FlowEdge {
  from: string;
  to: string;
  text: string;
}

interface EdgePathData {
  pathData: string;
  textX: number;
  textY: number;
  text: string;
}

const CENTER_X = 300;
const BRANCH_X = CENTER_X + 160;
const VERTICAL_GAP = 100;
const START_Y = 40;

export default function FlowchartMaker() {
  const [markup, setMarkup] = useState<string>(
    `A[시작]\nB[데이터 로드]\nC[조건 체크]\nD[성공 종료]\nE[에러 처리]\n\nA -> B\nB -> C\nC ->|Yes| D\nC ->|No| E`
  );

  const [nodes, setNodes] = useState<Record<string, FlowNode>>({});
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [paths, setPaths] = useState<EdgePathData[]>([]);

  const nodesLayerRef = useRef<HTMLDivElement>(null);

  const handleRender = () => {
    const parsedNodes: Record<string, FlowNode> = {};
    const parsedEdges: FlowEdge[] = [];

    const lines = markup.split('\n');
    let nodeIndex = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.includes('->')) {
        let fromId = '';
        let toId = '';
        let text = '';

        if (trimmed.includes('|')) {
          const parts = trimmed.split('->');
          fromId = parts[0].trim();
          const subParts = parts[1].split('|');
          text = subParts[1].trim();
          toId = subParts[2].trim();
        } else {
          const parts = trimmed.split('->');
          fromId = parts[0].trim();
          toId = parts[1].trim();
        }
        parsedEdges.push({ from: fromId, to: toId, text });
      }
      else if (trimmed.includes('[') && trimmed.includes(']')) {
        const id = trimmed.substring(0, trimmed.indexOf('[')).trim();
        const text = trimmed.substring(trimmed.indexOf('[') + 1, trimmed.indexOf(']')).trim();
        
        parsedNodes[id] = {
          id,
          text,
          x: CENTER_X,
          y: START_Y + nodeIndex * VERTICAL_GAP,
        };
        nodeIndex++;
      }
    });

    parsedEdges.forEach((edge) => {
      if ((edge.text.toLowerCase() === 'no' || edge.text === '아니오') && parsedNodes[edge.to]) {
        parsedNodes[edge.to].x = BRANCH_X;
        if (parsedNodes[edge.from]) {
          parsedNodes[edge.to].y = parsedNodes[edge.from].y + VERTICAL_GAP;
        }
      }
    });

    setNodes(parsedNodes);
    setEdges(parsedEdges);
  };

  const calculatePaths = () => {
    if (!nodesLayerRef.current) return;

    const newPaths: EdgePathData[] = [];

    edges.forEach((edge) => {
      const fromEl = nodesLayerRef.current?.querySelector(`#node-${edge.from}`) as HTMLDivElement;
      const toEl = nodesLayerRef.current?.querySelector(`#node-${edge.to}`) as HTMLDivElement;

      if (!fromEl || !toEl) return;

      const fromRect = {
        x: fromEl.offsetLeft,
        y: fromEl.offsetTop,
        w: fromEl.offsetWidth,
        h: fromEl.offsetHeight,
      };
      const toRect = {
        x: toEl.offsetLeft,
        y: toEl.offsetTop,
        w: toEl.offsetWidth,
        h: toEl.offsetHeight,
      };

      const fromCx = fromRect.x + fromRect.w / 2;
      const toCx = toRect.x + toRect.w / 2;
      const sameColumn = Math.abs(fromCx - toCx) < 20;

      let pathData = '';
      let textX = 0;
      let textY = 0;

      if (sameColumn) {
        const x = fromCx;
        const y1 = fromRect.y + fromRect.h;
        const y2 = toRect.y - 6;
        pathData = `M ${x} ${y1} L ${x} ${y2}`;
        textX = x + 8;
        textY = (y1 + y2) / 2;
      } else {
        const x1 = fromRect.x + fromRect.w;
        const y1 = fromRect.y + fromRect.h / 2;
        const x2 = toCx;
        const y2 = y1;
        const x3 = x2;
        const y3 = toRect.y - 6;
        pathData = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
        textX = x2 - 30;
        textY = y2 - 6;
      }

      newPaths.push({ pathData, textX, textY, text: edge.text });
    });

    setPaths(newPaths);
  };

  useEffect(() => {
    if (Object.keys(nodes).length > 0) {
      const timer = setTimeout(() => {
        calculatePaths();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges]);

  useEffect(() => {
    handleRender();
  }, [markup]);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 antialiased">
      {/* 사이드바 사이드 제어 영역 */}
      <div className="w-80 border-r border-slate-200 bg-white p-5 flex flex-col shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-600">
          마크업 입력
        </h2>
        <textarea
          className="w-full flex-1 resize-none rounded-lg border border-slate-300 p-3 font-mono text-sm shadow-inner outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          value={markup}
          onChange={(e) => setMarkup(e.target.value)}
          placeholder="마크업을 입력하세요..."
        />
        <button
          onClick={handleRender}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:bg-indigo-800 shadow-md"
        >
          순서도 그리기
        </button>
      </div>

      {/* 순서도 출력 캔버스 영역 */}
      <div className="flex flex-1 flex-col p-6 overflow-hidden">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-600">
          렌더링 결과
        </h2>
        <div className="relative w-full flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          
          {/* SVG 간선 레이어 */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
            <defs>
              <marker
                id="react-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-slate-400" />
              </marker>
            </defs>
            {paths.map((p, i) => (
              <g key={i}>
                <path
                  d={p.pathData}
                  className="stroke-slate-400 stroke-2 fill-none"
                  markerEnd="url(#react-arrow)"
                />
                {p.text && (
                  <text
                    x={p.textX}
                    y={p.textY}
                    className="fill-slate-500 font-sans text-xs font-bold"
                  >
                    {p.text}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* HTML 노드 레이어 */}
          <div ref={nodesLayerRef} className="absolute inset-0 w-full h-full">
            {Object.values(nodes).map((node) => (
              <div
                key={node.id}
                id={`node-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute min-w-[110px] transform rounded-lg border-2 border-indigo-400 bg-indigo-50 px-5 py-3 text-center text-sm font-medium text-indigo-900 shadow-md transition-transform z-20"
              >
                {node.text}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}