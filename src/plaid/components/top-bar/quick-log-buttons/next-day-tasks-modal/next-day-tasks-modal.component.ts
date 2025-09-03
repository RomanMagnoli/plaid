import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Issue } from '../../../../model/issue';

@Component({
  selector: 'plaid-next-day-tasks-modal',
  templateUrl: './next-day-tasks-modal.component.html',
  styleUrls: ['./next-day-tasks-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NextDayTasksModalComponent implements OnInit {
  @Input() defaultMessage = '';
  @Output() submitMessage = new EventEmitter<string>();
  @Output() cancelModal = new EventEmitter<void>();

  @ViewChild('finalTextArea') finalTextArea!: ElementRef<HTMLTextAreaElement>;

  selectedTasks: Issue[] = [];
  finalMessage = '';
  issuePickerOpen = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.finalMessage = this.defaultMessage;
  }

  onIssueSelected(issue: Issue): void {
    // Check if the task is already selected
    const alreadySelected = this.selectedTasks.find(task => task.key === issue.key);
    if (!alreadySelected) {
      this.selectedTasks.push(issue);
      this.updateFinalMessage();
      this.cdr.detectChanges();
    }
    // Don't close the picker automatically to allow multiple selections
    // User can click outside or press Escape to close
  }

  removeTask(index: number): void {
    this.selectedTasks.splice(index, 1);
    this.updateFinalMessage();
    this.cdr.detectChanges();
  }

  private updateFinalMessage(): void {
    if (this.selectedTasks.length === 0) {
      this.finalMessage = this.defaultMessage;
    } else {
      const taskLines = this.selectedTasks.map(task => `• ${task.key}: ${task.fields?.summary || 'No title'}`);
      this.finalMessage = taskLines.join('\n');
    }
  }

  openIssuePicker(): void {
    this.issuePickerOpen = true;
  }

  closeIssuePicker(): void {
    this.issuePickerOpen = false;
  }

  onSubmit(): void {
    const finalText = this.finalMessage.trim() || this.defaultMessage;
    this.submitMessage.emit(finalText);
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
