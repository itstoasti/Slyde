import React from 'react';
import { RecipeData } from '../types';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface RecipeQueueRibbonProps {
  queue: RecipeData[];
  activeId: string;
  onSelectRecipe: (recipe: RecipeData) => void;
  onRemoveFromQueue: (id: string, e: React.MouseEvent) => void;
  onAddNewBlank: () => void;
}

export const RecipeQueueRibbon: React.FC<RecipeQueueRibbonProps> = ({
  queue,
  activeId,
  onSelectRecipe,
  onRemoveFromQueue,
  onAddNewBlank
}) => {
  return (
    <div className="recipe-queue-ribbon">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={14} color="var(--app-primary)" />
        <span className="queue-label">Recipe Queue ({queue.length}):</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflowX: 'auto' }}>
        {queue.map((r) => {
          const isActive = r.id === activeId;
          const shortTitle = r.title.length > 24 ? `${r.title.slice(0, 22)}...` : r.title;
          return (
            <div
              key={r.id}
              className={`queue-item-pill ${isActive ? 'active' : ''}`}
              onClick={() => onSelectRecipe(r)}
            >
              <span>{shortTitle}</span>
              <span className="queue-ing-count">{r.ingredients.length} ings &bull; {r.method.length} steps</span>
              {queue.length > 1 && (
                <span
                  onClick={(e) => onRemoveFromQueue(r.id, e)}
                  style={{ opacity: 0.6, cursor: 'pointer', padding: '2px', display: 'flex' }}
                  title="Remove from queue"
                >
                  <Trash2 size={12} />
                </span>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddNewBlank}
          className="preset-chip"
          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          title="Add a new blank recipe"
        >
          <Plus size={13} />
          <span>New Recipe</span>
        </button>
      </div>
    </div>
  );
};
