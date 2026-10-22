import React, { useRef, useState, useEffect } from 'react';
import { Type, ArrowUpRight, Square, Circle, Hash, Edit3, RotateCw, Undo2, Redo2, Check, X, Trash2 } from 'lucide-react';

export interface AnnotationItem {
  id: string;
  type: 'text' | 'arrow' | 'rect' | 'circle' | 'number' | 'draw';
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  width?: number; // 0..1 normalized
  height?: number; // 0..1 normalized
  endX?: number; // 0..1 normalized
  endY?: number; // 0..1 normalized
  text?: string;
  number?: number;
  color: string;
  fontSize?: number;
  points?: { x: number; y: number }[];
}

interface ImageAnnotationEditorProps {
  imageUrl: string;
  initialAnnotations?: AnnotationItem[];
  fileId: string;
  itemTitle?: string;
  onSave: (annotations: AnnotationItem[]) => Promise<void>;
  onClose: () => void;
}

export const ImageAnnotationEditor: React.FC<ImageAnnotationEditorProps> = ({
  imageUrl,
  initialAnnotations = [],
  fileId,
  itemTitle,
  onSave,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(initialAnnotations);
  const [history, setHistory] = useState<AnnotationItem[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [activeTool, setActiveTool] = useState<'text' | 'arrow' | 'rect' | 'circle' | 'number' | 'draw' | 'select'>('text');
  const [selectedColor, setSelectedColor] = useState<string>('#e53e3e');
  const [textInput, setTextInput] = useState<string>('จอ LED 7.68 × 4.32 ม.');
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDraw, setCurrentDraw] = useState<AnnotationItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
  }, [imageUrl]);

  // Push new state to history
  const pushState = (newAnnotations: AnnotationItem[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setAnnotations(newAnnotations);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };

  // Re-render canvas whenever annotations or image change
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObjRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageObjRef.current;
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw background image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Render each annotation
    const allItems = currentDraw ? [...annotations, currentDraw] : annotations;

    for (const ann of allItems) {
      ctx.save();
      const x = ann.x * canvas.width;
      const y = ann.y * canvas.height;
      const w = (ann.width || 0) * canvas.width;
      const h = (ann.height || 0) * canvas.height;

      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = Math.max(3, canvas.width * 0.004);

      if (ann.type === 'text' && ann.text) {
        ctx.font = `bold ${ann.fontSize || 32}px 'TH Sarabun New', sans-serif`;
        const metrics = ctx.measureText(ann.text);
        const padding = 8;
        // Text background box for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x - padding, y - (ann.fontSize || 32), metrics.width + padding * 2, (ann.fontSize || 32) + padding);
        // Text outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeText(ann.text, x, y - 2);
        // Text fill
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text, x, y - 2);
      } else if (ann.type === 'rect') {
        ctx.strokeRect(x, y, w, h);
      } else if (ann.type === 'circle') {
        const radius = Math.sqrt(w * w + h * h) / 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.max(radius, 10), 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === 'number') {
        const radius = Math.max(18, canvas.width * 0.015);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = ann.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${radius * 1.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ann.number || 1), x, y);
      } else if (ann.type === 'arrow' && ann.endX !== undefined && ann.endY !== undefined) {
        const endX = ann.endX * canvas.width;
        const endY = ann.endY * canvas.height;
        drawArrow(ctx, x, y, endX, endY, ann.color, Math.max(4, canvas.width * 0.005));
      } else if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x * canvas.width, ann.points[0].y * canvas.height);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * canvas.width, ann.points[i].y * canvas.height);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, width: number) => {
    const headlen = width * 4;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  useEffect(() => {
    renderCanvas();
  }, [annotations, currentDraw]);

  // Pointer event handlers on canvas (supports touch & mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const normX = ((e.clientX - rect.left) * scaleX) / canvas.width;
    const normY = ((e.clientY - rect.top) * scaleY) / canvas.height;

    setIsDrawing(true);

    if (activeTool === 'text') {
      const newAnn: AnnotationItem = {
        id: `ann-${Date.now()}`,
        type: 'text',
        x: normX,
        y: normY,
        text: textInput,
        color: selectedColor,
        fontSize: Math.round(canvas.width * 0.024)
      };
      pushState([...annotations, newAnn]);
      setIsDrawing(false);
    } else if (activeTool === 'number') {
      const newAnn: AnnotationItem = {
        id: `ann-${Date.now()}`,
        type: 'number',
        x: normX,
        y: normY,
        number: nextNumber,
        color: selectedColor
      };
      setNextNumber(nextNumber + 1);
      pushState([...annotations, newAnn]);
      setIsDrawing(false);
    } else if (activeTool === 'draw') {
      setCurrentDraw({
        id: `ann-${Date.now()}`,
        type: 'draw',
        x: normX,
        y: normY,
        color: selectedColor,
        points: [{ x: normX, y: normY }]
      });
    } else if (activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'circle') {
      setCurrentDraw({
        id: `ann-${Date.now()}`,
        type: activeTool,
        x: normX,
        y: normY,
        width: 0,
        height: 0,
        endX: normX,
        endY: normY,
        color: selectedColor
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const normX = ((e.clientX - rect.left) * scaleX) / canvas.width;
    const normY = ((e.clientY - rect.top) * scaleY) / canvas.height;

    if (currentDraw.type === 'draw' && currentDraw.points) {
      setCurrentDraw({
        ...currentDraw,
        points: [...currentDraw.points, { x: normX, y: normY }]
      });
    } else {
      setCurrentDraw({
        ...currentDraw,
        width: normX - currentDraw.x,
        height: normY - currentDraw.y,
        endX: normX,
        endY: normY
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentDraw) {
      pushState([...annotations, currentDraw]);
      setCurrentDraw(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(annotations);
      onClose();
    } catch (err) {
      console.error('Failed to save annotations:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            🎨 เครื่องมือใส่คำอธิบายและสัญลักษณ์บนภาพ (Non-destructive Editor)
          </h3>
          <p className="text-xs text-slate-400">
            {itemTitle || 'ภาพถ่ายหลักฐาน'} • ต้นฉบับจะไม่ถูกทำลาย สามารถแก้ไขได้ตลอดเวลา
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกคำอธิบายภาพ'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Toolbar */}
        <div className="bg-slate-900/90 border-r border-slate-800 p-3 flex md:flex-col gap-2 items-center justify-center overflow-x-auto">
          {/* Tools */}
          <button
            onClick={() => setActiveTool('text')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'text' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="ใส่ข้อความ (Text)"
          >
            <Type className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'arrow' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="ลูกศรชี้ตำแหน่ง (Arrow)"
          >
            <ArrowUpRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'rect' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="กรอบสี่เหลี่ยม (Rectangle)"
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'circle' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="วงกลมเน้นจุด (Circle)"
          >
            <Circle className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('number')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'number' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="หมายเลขลำดับ (Number Badge)"
          >
            <Hash className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTool('draw')}
            className={`p-2.5 rounded-xl flex items-center gap-1 text-sm font-medium transition ${
              activeTool === 'draw' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="วาดอิสระ (Freehand Draw)"
          >
            <Edit3 className="w-5 h-5" />
          </button>

          <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />

          {/* Color Palettes */}
          {['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#ffffff'].map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${
                selectedColor === c ? 'border-white scale-110 shadow-lg' : 'border-slate-700 opacity-70'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />

          {/* Undo / Redo / Clear */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => pushState([])}
            className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/40"
            title="ล้างทั้งหมด"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
          {/* Active text input bar if text tool is selected */}
          {activeTool === 'text' && (
            <div className="w-full max-w-md mb-2 flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="พิมพ์ข้อความที่ต้องการใส่บนภาพ..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400 self-center">แตะตำแหน่งในภาพเพื่อวาง</span>
            </div>
          )}

          <div className="relative border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-[75vh] flex items-center justify-center bg-slate-950">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="max-h-[75vh] w-auto h-auto object-contain cursor-crosshair touch-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
