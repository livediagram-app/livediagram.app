// @vitest-environment jsdom
// @liveworkspace/capture: the sources, whether this browser can capture, the devices and their names, the level meter
// and the picker.
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_CONSTRAINTS, canCapture, MIC_CONSTRAINTS, onDevice } from './constraints';
import { listDevices, NO_DEVICES, useMediaDevices } from './devices';
import { DevicePicker, NO_CAMERA } from './DevicePicker';
import { levelMeter, meterFill, rmsOf } from './level';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sources', () => {
  it('asks for a picked device, else the default', () => {
    expect(onDevice(MIC_CONSTRAINTS, null)).toBe(MIC_CONSTRAINTS);
    expect(onDevice(MIC_CONSTRAINTS, 'm1').audio).toMatchObject({
      echoCancellation: true,
      deviceId: { exact: 'm1' },
    });
    expect(onDevice(CAMERA_CONSTRAINTS, 'c1').video).toMatchObject({ deviceId: { exact: 'c1' } });
    expect(onDevice({ audio: true }, 'm2').audio).toEqual({ deviceId: { exact: 'm2' } });
  });

  it('says whether this browser can capture each kind', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: () => undefined },
    });
    expect(canCapture('microphone')).toBe(true);
    expect(canCapture('camera')).toBe(true);
    expect(canCapture('screen')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(canCapture('camera')).toBe(false);
    vi.stubGlobal('isSecureContext', false);
    expect(canCapture('camera')).toBe(false);
  });
});

const info = (kind: MediaDeviceKind, deviceId: string, label = '') =>
  ({ kind, deviceId, label }) as MediaDeviceInfo;

describe('devices', () => {
  it('names each, before and after the browser allows names', async () => {
    const source = {
      enumerateDevices: async () => [
        info('audioinput', 'm1'),
        info('audioinput', 'm2', ' Desk Mic '),
        info('videoinput', 'c1'),
        info('audiooutput', 'o1'),
        info('videoinput', ''),
      ],
    };
    expect(await listDevices(source)).toEqual({
      microphones: [
        { id: 'm1', label: 'Microphone 1' },
        { id: 'm2', label: 'Desk Mic' },
      ],
      cameras: [{ id: 'c1', label: 'Camera 1' }],
      locked: { microphones: false, cameras: false },
    });
  });

  it('says a kind is locked where the browser hides it until allowed', async () => {
    const source = {
      enumerateDevices: async () => [info('audioinput', ''), info('videoinput', '')],
    };
    expect(await listDevices(source)).toEqual({
      microphones: [],
      cameras: [],
      locked: { microphones: true, cameras: true },
    });
  });

  it('lists none where the browser cannot', async () => {
    expect(await listDevices(undefined)).toBe(NO_DEVICES);
    expect(await listDevices({ enumerateDevices: () => Promise.reject(new Error('no')) })).toBe(
      NO_DEVICES,
    );
  });

  it('keeps the list current while it is wanted', async () => {
    const target = new EventTarget();
    let mics = [info('audioinput', 'm1')];
    vi.stubGlobal('navigator', {
      mediaDevices: Object.assign(target, { enumerateDevices: async () => mics }),
    });
    const { result, rerender, unmount } = renderHook(({ on }) => useMediaDevices(on), {
      initialProps: { on: false },
    });
    expect(result.current).toBe(NO_DEVICES);
    rerender({ on: true });
    await act(async () => {});
    expect(result.current.microphones).toHaveLength(1);
    mics = [info('audioinput', 'm1'), info('audioinput', 'm2')];
    await act(async () => {
      target.dispatchEvent(new Event('devicechange'));
    });
    expect(result.current.microphones).toHaveLength(2);
    unmount();
  });

  it('drops an answer that lands after it is gone', async () => {
    let answer: (v: MediaDeviceInfo[]) => void = () => undefined;
    vi.stubGlobal('navigator', {
      mediaDevices: { enumerateDevices: () => new Promise((r) => (answer = r)) },
    });
    const { result, unmount } = renderHook(() => useMediaDevices(true));
    unmount();
    await act(async () => answer([info('audioinput', 'm1')]));
    expect(result.current).toBe(NO_DEVICES);
  });
});

describe('the level', () => {
  it('measures loudness as a fill', () => {
    expect(rmsOf(new Float32Array())).toBe(0);
    expect(rmsOf(new Float32Array([0.5, -0.5]))).toBe(0.5);
    expect(meterFill(0)).toBe(0);
    expect(meterFill(1)).toBe(1);
    expect(meterFill(0.01)).toBeCloseTo(0.25, 2);
  });

  it('reads a stream through an analyser and closes without stopping it', () => {
    const connect = vi.fn();
    const close = vi.fn(() => Promise.reject(new Error('closed')));
    const analyser = {
      fftSize: 0,
      getFloatTimeDomainData: (out: Float32Array) => out.fill(1),
    } as unknown as AnalyserNode;
    const meter = levelMeter({} as MediaStream, () => ({
      createAnalyser: () => analyser,
      createMediaStreamSource: () => ({ connect }) as unknown as MediaStreamAudioSourceNode,
      close,
    }));
    expect(connect).toHaveBeenCalledWith(analyser);
    expect(meter.read()).toBe(1);
    meter.close();
    expect(close).toHaveBeenCalled();
  });

  it('opens an AudioContext by default', () => {
    const made = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          made();
        }
        createAnalyser() {
          return { fftSize: 0, getFloatTimeDomainData: () => undefined };
        }
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        close() {
          return Promise.resolve();
        }
      },
    );
    levelMeter({} as MediaStream).close();
    expect(made).toHaveBeenCalled();
  });
});

describe('the picker', () => {
  const devices = {
    microphones: [{ id: 'm1', label: 'Desk Mic' }],
    cameras: [{ id: 'c1', label: 'FaceTime' }],
  };
  const props = {
    microphone: null,
    camera: null,
    onMicrophone: () => undefined,
    onCamera: () => undefined,
    cameraOn: true,
    onCameraOn: () => undefined,
    onAllow: () => undefined,
  };
  const options = (el: HTMLElement) => [...(el as HTMLSelectElement).options].map((o) => o.text);

  it('picks a microphone and a camera; off is the switch, not an entry in the list', () => {
    const onMicrophone = vi.fn();
    const onCamera = vi.fn();
    const onCameraOn = vi.fn();
    render(
      <DevicePicker
        {...props}
        devices={devices}
        onMicrophone={onMicrophone}
        onCamera={onCamera}
        onCameraOn={onCameraOn}
      />,
    );
    fireEvent.change(screen.getByLabelText('Microphone'), { target: { value: 'm1' } });
    expect(onMicrophone).toHaveBeenLastCalledWith('m1');
    fireEvent.change(screen.getByLabelText('Microphone'), { target: { value: '' } });
    expect(onMicrophone).toHaveBeenLastCalledWith(null);
    fireEvent.change(screen.getByLabelText('Which Camera'), { target: { value: 'c1' } });
    expect(onCamera).toHaveBeenLastCalledWith('c1');
    fireEvent.change(screen.getByLabelText('Which Camera'), { target: { value: '' } });
    expect(onCamera).toHaveBeenLastCalledWith(null);
    expect(options(screen.getByLabelText('Which Camera'))).not.toContain('No Camera');
    fireEvent.click(screen.getByRole('switch', { name: 'Camera' }));
    expect(onCameraOn).toHaveBeenLastCalledWith(false);
  });

  it('lists the two kinds the same way', () => {
    render(<DevicePicker {...props} devices={devices} />);
    const mic = screen.getByLabelText('Microphone') as HTMLSelectElement;
    const cam = screen.getByLabelText('Which Camera') as HTMLSelectElement;
    expect(options(mic)).toEqual(['Default', 'Desk Mic']);
    expect(options(cam)).toEqual(['Default', 'FaceTime']);
    expect(mic.disabled).toBe(cam.disabled);
  });

  it('shows the picked devices, and no list while the camera is off', () => {
    const { rerender } = render(
      <DevicePicker {...props} devices={devices} microphone="m1" camera="c1" />,
    );
    expect((screen.getByLabelText('Which Camera') as HTMLSelectElement).value).toBe('c1');
    expect((screen.getByLabelText('Microphone') as HTMLSelectElement).value).toBe('m1');
    rerender(<DevicePicker {...props} devices={devices} camera={NO_CAMERA} cameraOn={false} />);
    expect(screen.getByRole('switch', { name: 'Camera' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.queryByLabelText('Which Camera')).toBeNull();
    expect(screen.getByText('Off, sound only')).toBeTruthy();
    // A camera id of none (an older choice) reads as the default once the switch is on.
    rerender(<DevicePicker {...props} devices={devices} camera={NO_CAMERA} />);
    expect((screen.getByLabelText('Which Camera') as HTMLSelectElement).value).toBe('');
  });

  it('says No Microphone Found and No Camera Found alike, and can leave the camera out', () => {
    const { rerender } = render(<DevicePicker {...props} devices={NO_DEVICES} />);
    const mic = screen.getByLabelText('Microphone') as HTMLSelectElement;
    const cam = screen.getByLabelText('Which Camera') as HTMLSelectElement;
    expect(options(mic)).toEqual(['No Microphone Found']);
    expect(options(cam)).toEqual(['No Camera Found']);
    expect(mic.disabled).toBe(true);
    expect(cam.disabled).toBe(true);
    rerender(<DevicePicker {...props} devices={NO_DEVICES} withCamera={false} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('offers to ask the browser for a kind it has not been allowed to list yet', () => {
    const onAllow = vi.fn();
    render(
      <DevicePicker
        {...props}
        devices={{ ...NO_DEVICES, locked: { microphones: true, cameras: true } }}
        onAllow={onAllow}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getAllByText('Not allowed yet')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Allow Microphone' }));
    expect(onAllow).toHaveBeenLastCalledWith('microphone');
    fireEvent.click(screen.getByRole('button', { name: 'Allow Camera' }));
    expect(onAllow).toHaveBeenLastCalledWith('camera');
  });
});
