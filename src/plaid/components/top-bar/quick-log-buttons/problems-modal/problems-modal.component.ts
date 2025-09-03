import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'plaid-problems-modal',
  templateUrl: './problems-modal.component.html',
  styleUrls: ['./problems-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProblemsModalComponent implements OnInit {
  @Input() defaultMessage = '';
    @Output() submitMessage = new EventEmitter<string>();
  @Output() cancelModal = new EventEmitter<void>();

  @ViewChild('textArea') textArea!: ElementRef<HTMLTextAreaElement>;

  messageText = '';

  ngOnInit(): void {
    this.messageText = this.defaultMessage;
    // Enfocar el textarea cuando se abre el modal
    setTimeout(() => {
      if (this.textArea) {
        this.textArea.nativeElement.focus();
        if (this.messageText === this.defaultMessage && this.defaultMessage) {
          this.textArea.nativeElement.select();
        }
      }
    });
  }

  onSubmit(): void {
    const finalMessage = this.messageText.trim() || this.defaultMessage;
    this.submitMessage.emit(finalMessage);
  }

  onCancel(): void {
    this.cancelModal.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onCancel();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      this.onSubmit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}
