'use client';

import type React from 'react';

import { FaEllipsisV, FaPlus, FaRegUser } from 'react-icons/fa';

import type { Deal } from '@/context/crm-context';

type KanbanStage = {
  id: string;
  name: string;
  color?: string;
};

interface CrmKanbanColumnProps {
  stage: KanbanStage;
  deals: Deal[];
  totalValue: number;
  draggedDealId: string | null;
  onColumnDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onColumnDrop: (stageId: string) => void;
  onDealDragStart: (dealId: string, stageId: string) => void;
  onDealClick: (deal: Deal) => void;
  getContactName: (contactId: string) => string | undefined;
  renderUserAvatar: (
    name: string,
    size?: string,
    textSize?: string
  ) => React.ReactNode;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function CrmKanbanColumn({
  stage,
  deals,
  totalValue,
  draggedDealId,
  onColumnDragOver,
  onColumnDrop,
  onDealDragStart,
  onDealClick,
  getContactName,
  renderUserAvatar,
}: CrmKanbanColumnProps) {
  const stageColor = stage.color || '#6366F1';

  return (
    <div
      className="flex flex-col w-80 min-w-[20rem] bg-card rounded-xl border border-border overflow-hidden"
      onDragOver={onColumnDragOver}
      onDrop={() => onColumnDrop(stage.id)}
    >
      <div className="p-4 border-b border-muted-foreground/20 bg-card/10 backdrop-blur-sm sticky top-0 z-10 rounded-t-3xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: stageColor }}
            />
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted">
              {stage.name}
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {deals.length}
          </span>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {currencyFormatter.format(totalValue)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
        {deals.map((deal) => {
          const ownerName = deal.owner?.name;
          const contactName = getContactName(deal.contactId);

          return (
            <div
              key={deal.id}
              className={`group bg-card hover:bg-card/80 border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden ${
                draggedDealId === deal.id ? 'opacity-40 scale-95' : ''
              }`}
              draggable
              onDragStart={() => onDealDragStart(deal.id, stage.id)}
              onClick={() => onDealClick(deal)}
            >
              <div
                className="absolute top-0 left-0 h-1 transition-all duration-500"
                style={{ width: '100%', backgroundColor: stageColor }}
              />
              <div className="flex justify-between items-start gap-2 mb-3">
                <h4 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors select-none">
                  {deal.title}
                </h4>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="text-muted-foreground/40 hover:text-foreground p-1 -mr-1 transition-colors cursor-pointer"
                  aria-label="Mais opções"
                >
                  <FaEllipsisV size={12} />
                </button>
              </div>
              <div className="flex items-baseline gap-1 mb-4 select-none">
                <span className="text-xs text-muted-foreground font-medium">
                  R$
                </span>
                <span className="text-lg font-bold tracking-tight">
                  {deal.value.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-auto select-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="bg-muted p-1 rounded text-muted-foreground">
                    <FaRegUser size={10} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground truncate select-none">
                    {contactName || 'Sem contato'}
                  </span>
                </div>
                {ownerName &&
                  renderUserAvatar(ownerName, 'w-6 h-6', 'text-[10px]')}
              </div>
            </div>
          );
        })}

        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border text-muted-foreground/50 transition-colors hover:border-primary/20 hover:text-primary/30">
            <FaPlus size={20} className="mb-2 opacity-20" />
            <span className="text-xs font-medium">Arraste ou crie aqui</span>
          </div>
        )}
      </div>
    </div>
  );
}
