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
  const flowchartRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPng = () => {
    const container = flowchartRef.current;
    if (!container) return;

    const nodeEls = container.querySelectorAll<HTMLDivElement>('[id^="node-"]');
    if (!nodeEls.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rects: { x: number; y: number; w: number; h: number; text: string; shape: string }[] = [];

    nodeEls.forEach((el) => {
      const x = el.offsetLeft;
      const y = el.offsetTop;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      rects.push({ x, y, w, h, text: el.textContent || '', shape: el.dataset.branch === 'true' ? 'branch' : 'rect' });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const pad = 40;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = cw * 2;
    canvas.height = ch * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.translate(pad - minX, pad - minY);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(minX - pad, minY - pad, cw, ch);

    const arrowSize = 6;

    for (const p of paths) {
      const coords = p.pathData.match(/[\d.-]+/g)?.map(Number) || [];
      if (coords.length < 4) continue;

      ctx.beginPath();
      ctx.moveTo(coords[0], coords[1]);
      for (let i = 2; i < coords.length; i += 2) {
        ctx.lineTo(coords[i], coords[i + 1]);
      }
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      const ex = coords[coords.length - 2];
      const ey = coords[coords.length - 1];
      const px = coords[coords.length - 4];
      const py = coords[coords.length - 3];
      const angle = Math.atan2(ey - py, ex - px);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - arrowSize * Math.cos(angle - 0.4), ey - arrowSize * Math.sin(angle - 0.4));
      ctx.lineTo(ex - arrowSize * Math.cos(angle + 0.4), ey - arrowSize * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();

      if (p.text) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.textX, p.textY);
      }
    }

    rects.forEach(({ x, y, w, h, text, shape }) => {
      const isBranch = shape === 'branch';
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fillStyle = '#eef2ff';
      ctx.fill();
      ctx.strokeStyle = isBranch ? '#34d399' : '#818cf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#3730a3';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
    });

    const link = document.createElement('a');
    link.download = 'diagram.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
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

  const nodeList = Object.values(nodes);
  const hasFlow = nodeList.length > 0;
  const flowW = hasFlow ? Math.max(...nodeList.map(n => n.x + 200), 400) : 0;
  const flowH = hasFlow ? Math.max(...nodeList.map(n => n.y + 80), 200) : 0;

  const diamondIds = new Set<string>();
  edges.forEach(e => { if (e.text) diamondIds.add(e.from); });

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 text-slate-800 antialiased">
      {/* 사이드바 사이드 제어 영역 */}
      <div className="w-full md:w-80 border-r border-slate-200 bg-white p-5 flex flex-col shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-600">
          마크업 입력
        </h2>
        <textarea
          className="w-full h-48 md:flex-1 resize-none rounded-lg border border-slate-300 p-3 font-mono text-sm shadow-inner outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
      <div className="flex flex-1 flex-col p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-600">
            렌더링 결과
          </h2>
          <button
            onClick={handleDownloadPng}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 shadow-md"
          >
            PNG 다운로드
          </button>
        </div>
        <div ref={flowchartRef} className="relative w-full flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="relative" style={{ width: hasFlow ? flowW + 'px' : '100%', minHeight: '100%' }}>
          
          {/* SVG 간선 레이어 */}
          <svg className="absolute top-0 left-0 pointer-events-none z-10" style={{ width: hasFlow ? flowW + 'px' : '100%', height: hasFlow ? flowH + 'px' : '100%', overflow: 'visible' }}>
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
          <div ref={nodesLayerRef} className="relative" style={{ width: hasFlow ? flowW + 'px' : '100%', minHeight: hasFlow ? flowH + 'px' : '100%' }}>
            {Object.values(nodes).map((node) => {
              const isBranch = diamondIds.has(node.id);
              return (
              <div
                key={node.id}
                id={`node-${node.id}`}
                data-branch={isBranch ? 'true' : undefined}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className={`absolute min-w-[110px] rounded-lg border-2 px-5 py-3 text-center text-sm font-medium shadow-md z-20 ${
                  isBranch
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : 'border-indigo-400 bg-indigo-50 text-indigo-900'
                }`}
              >
                {node.text}
              </div>
              );
            })}
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}