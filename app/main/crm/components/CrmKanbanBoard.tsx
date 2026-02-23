'use client';

import type React from 'react';
import { useMemo } from 'react';

import type { Deal } from '@/context/crm-context';

import { CrmKanbanColumn } from './CrmKanbanColumn';

type KanbanStage = {
  id: string;
  name: string;
  color?: string;
};

interface CrmKanbanBoardProps {
  stages: KanbanStage[];
  deals: Deal[];
  boardRef?: React.RefObject<HTMLDivElement | null>;
  draggedDealId: string | null;
  onBoardDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
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
  className?: string;
}

const defaultBoardViewportClassName =
  'h-full w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent scrollbar-background-transparent';
const defaultBoardTrackClassName = 'flex h-full min-w-max gap-4 pb-4';

export function CrmKanbanBoard({
  stages,
  deals,
  boardRef,
  draggedDealId,
  onBoardDragOver,
  onColumnDragOver,
  onColumnDrop,
  onDealDragStart,
  onDealClick,
  getContactName,
  renderUserAvatar,
  className,
}: CrmKanbanBoardProps) {
  const dealsByStage = useMemo(() => {
    const grouped = new Map<string, Deal[]>();

    for (const deal of deals) {
      const list = grouped.get(deal.stage) ?? [];
      list.push(deal);
      grouped.set(deal.stage, list);
    }

    return grouped;
  }, [deals]);

  return (
    <div
      ref={boardRef}
      className={
        className
          ? `${defaultBoardViewportClassName} ${className}`
          : defaultBoardViewportClassName
      }
      onDragOver={onBoardDragOver}
    >
      <div className={defaultBoardTrackClassName}>
        {stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? [];
          const stageTotal = stageDeals.reduce((acc, deal) => acc + deal.value, 0);

          return (
            <CrmKanbanColumn
              key={stage.id}
              stage={stage}
              deals={stageDeals}
              totalValue={stageTotal}
              draggedDealId={draggedDealId}
              onColumnDragOver={onColumnDragOver}
              onColumnDrop={onColumnDrop}
              onDealDragStart={onDealDragStart}
              onDealClick={onDealClick}
              getContactName={getContactName}
              renderUserAvatar={renderUserAvatar}
            />
          );
        })}
      </div>
    </div>
  );
}
