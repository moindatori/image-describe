import React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const [isOpen, setIsOpen] = React.useState(open || false);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <div data-dialog-open={isOpen.toString()}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === DialogContent) {
            return React.cloneElement(child as React.ReactElement<any>, {
              open: isOpen,
              onOpenChange: handleOpenChange
            });
          }
          if (child.type === DialogTrigger) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onClick: () => handleOpenChange(true)
            });
          }
        }
        return child;
      })}
    </div>
  );
};

const DialogTrigger: React.FC<DialogTriggerProps> = ({ 
  children, 
  onClick, 
  asChild,
  ...props 
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClick?.(e);
  };

  const handleDivClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
  };

  if (asChild) {
    return <div onClick={handleDivClick}>{children}</div>;
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

const DialogContent: React.FC<DialogContentProps & { open?: boolean; onOpenChange?: (open: boolean) => void }> = ({ 
  children, 
  className, 
  open, 
  onOpenChange,
  ...props 
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange?.(false)}
      />
      <div
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

const DialogHeader: React.FC<DialogHeaderProps> = ({ 
  children, 
  className, 
  ...props 
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  >
    {children}
  </div>
);

const DialogTitle: React.FC<DialogTitleProps> = ({ 
  children, 
  className, 
  ...props 
}) => (
  <h3
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </h3>
);

const DialogDescription: React.FC<DialogDescriptionProps> = ({ 
  children, 
  className, 
  ...props 
}) => (
  <p
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  >
    {children}
  </p>
);

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogFooter: React.FC<DialogFooterProps> = ({ 
  children, 
  className, 
  ...props 
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  >
    {children}
  </div>
);

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};