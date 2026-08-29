import { Segmented, SettingRow, Slider, Switch } from '../../components/form';
import { useSession } from '../../store/session';
import { t } from "../../lib/i18n";
export function EditorSettings() {
    const settings = useSession((s) => s.settings);
    const update = useSession((s) => s.updateSettings);
    const editor = settings.editor;
    const preview = settings.preview;
    return (<div className="space-y-6">
      <section>
        <SettingRow title={t("settings.editor_font")}>
          <Segmented<'mono' | 'sans'> label={t("settings.editor_font")} value={editor.fontFamily} onChange={(fontFamily) => void update({ editor: { fontFamily } })} options={[
            { value: 'mono', label: t("settings.monospace") },
            { value: 'sans', label: t("common.sans_serif") },
        ]}/>
        </SettingRow>

        <SettingRow title={t("settings.editor_font_size")}>
          <Slider label={t("settings.editor_font_size")} className="w-[200px]" value={editor.fontSize} min={12} max={22} onChange={(fontSize) => void update({ editor: { fontSize } })} suffix="px"/>
        </SettingRow>

        <SettingRow title={t("settings.show_line_numbers")}>
          <Switch checked={editor.lineNumbers} onChange={(lineNumbers) => void update({ editor: { lineNumbers } })} label={t("settings.show_line_numbers")}/>
        </SettingRow>

        <SettingRow title={t("settings.show_toolbar")}>
          <Switch checked={editor.showToolbar} onChange={(showToolbar) => void update({ editor: { showToolbar } })} label={t("settings.show_toolbar")}/>
        </SettingRow>

        <SettingRow title={t("settings.spellcheck")}>
          <Switch checked={editor.spellcheck} onChange={(spellcheck) => void update({ editor: { spellcheck } })} label={t("settings.spellcheck")}/>
        </SettingRow>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--text-quaternary)]">{t("settings.writing_mode")}</h3>

        <SettingRow title={t("settings.typewriter_mode")} description={t("settings.keep_the_cursor_line_centered_on_screen")}>
          <Switch checked={editor.typewriter} onChange={(typewriter) => void update({ editor: { typewriter } })} label={t("settings.typewriter_mode")}/>
        </SettingRow>

        <SettingRow title={t("settings.focus_mode")} description={t("settings.fade_content_outside_the_current_paragraph")}>
          <Switch checked={editor.focusMode} onChange={(focusMode) => void update({ editor: { focusMode } })} label={t("settings.focus_mode")}/>
        </SettingRow>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-[var(--text-quaternary)]">{t("common.preview")}</h3>

        <SettingRow title={t("settings.scroll_sync")} description={t("settings.keep_the_editor_and_preview_scrolled_together")}>
          <Switch checked={preview.syncScroll} onChange={(syncScroll) => void update({ preview: { syncScroll } })} label={t("settings.scroll_sync")}/>
        </SettingRow>

        <SettingRow title={t("settings.math")} description={t("settings.render_and_using_katex")}>
          <Switch checked={preview.math} onChange={(math) => void update({ preview: { math } })} label={t("settings.math")}/>
        </SettingRow>

        <SettingRow title={t("settings.diagram")} description={t("settings.render_mermaid_code_blocks_into_flowcharts")}>
          <Switch checked={preview.mermaid} onChange={(mermaid) => void update({ preview: { mermaid } })} label={t("settings.diagram")}/>
        </SettingRow>

        <SettingRow title={t("settings.collapse_long_code_blocks")} description={t("settings.collapse_long_code_blocks_description")}>
          <Switch checked={preview.codeBlockCollapse} onChange={(codeBlockCollapse) => void update({ preview: { codeBlockCollapse } })} label={t("settings.collapse_long_code_blocks")}/>
        </SettingRow>

        {preview.codeBlockCollapse && <SettingRow title={t("settings.code_block_collapse_after")}>
          <Slider label={t("settings.code_block_collapse_after")} className="w-[200px]" value={preview.codeBlockCollapseLines} min={8} max={100} step={1} onChange={(codeBlockCollapseLines) => void update({ preview: { codeBlockCollapseLines } })} suffix={t("settings.lines")}/>
        </SettingRow>}

        <SettingRow title={t("settings.show_outline_by_default")}>
          <Switch checked={preview.showToc} onChange={(showToc) => void update({ preview: { showToc } })} label={t("settings.show_outline_by_default")}/>
        </SettingRow>
      </section>

      <section>
        <SettingRow title={t("settings.autosave_delay")} description={t("settings.delay_before_uploading_after_you_stop_typing_shorter_makes_more_requests")}>
          <Slider label={t("settings.autosave_delay")} className="w-[200px]" value={editor.autoSaveDelay} min={200} max={3000} step={100} onChange={(autoSaveDelay) => void update({ editor: { autoSaveDelay } })} suffix="ms"/>
        </SettingRow>

        <SettingRow title={t("settings.indent_width")}>
          <Segmented<string> label={t("settings.indent_width")} value={String(editor.tabSize)} onChange={(value) => void update({ editor: { tabSize: Number(value) } })} options={[
            { value: '2', label: '2' },
            { value: '4', label: '4' },
        ]}/>
        </SettingRow>
      </section>
    </div>);
}
